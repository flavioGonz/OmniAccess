const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const prisma = new PrismaClient();

// ==========================================
// WAHA WEBHOOK HANDLER (WhatsApp Chatbot)
// ==========================================
const handleWahaWebhook = async (req, res, logPrefix) => {
    try {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        await new Promise(resolve => req.on('end', resolve));

        const payload = JSON.parse(body);
        console.log(`${logPrefix} [WAHA] Webhook received:`, JSON.stringify(payload, null, 2));

        // Extract message data
        const event = payload.event; // 'message', 'message.any', etc.
        const session = payload.session;
        const messageData = payload.payload;

        if (!messageData || event !== 'message') {
            console.log(`${logPrefix} [WAHA] Ignoring non-message event: ${event}`);
            res.writeHead(200);
            res.end('OK');
            return;
        }

        const from = messageData.from; // Phone number with @c.us
        const body_text = messageData.body || '';
        const chatId = from;

        console.log(`${logPrefix} [WAHA] Message from ${from}: "${body_text}"`);

        // Get WAHA configuration
        const wahaUrlSetting = await prisma.setting.findUnique({ where: { key: 'WAHA_URL' } });
        const wahaApiKeySetting = await prisma.setting.findUnique({ where: { key: 'WAHA_API_KEY' } });

        const wahaUrl = wahaUrlSetting?.value;
        const wahaApiKey = wahaApiKeySetting?.value;

        if (!wahaUrl) {
            console.warn(`${logPrefix} [WAHA] WAHA_URL not configured. Cannot send responses.`);
            res.writeHead(200);
            res.end('OK');
            return;
        }

        // Simple AI Chatbot Logic
        let response = '';
        const lowerBody = body_text.toLowerCase().trim();

        if (lowerBody.includes('hola') || lowerBody.includes('hi') || lowerBody === 'menu') {
            response = `🏠 *OmniAccess - Asistente Virtual*\n\nComandos disponibles:\n• "estado" - Estado del sistema\n• "últimos accesos" - Últimos 5 eventos\n• "quién está" - Personas en el edificio\n• "abrir [puerta]" - Control remoto\n• "cámaras" - Estado de dispositivos`;
        } else if (lowerBody.includes('estado')) {
            const deviceCount = await prisma.device.count();
            const userCount = await prisma.user.count();
            const todayEvents = await prisma.accessEvent.count({
                where: {
                    timestamp: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            });
            response = `📊 *Estado del Sistema*\n\n✅ Sistema Operativo\n🎥 Dispositivos: ${deviceCount}\n👥 Usuarios: ${userCount}\n📈 Eventos hoy: ${todayEvents}`;
        } else if (lowerBody.includes('últimos') || lowerBody.includes('accesos')) {
            const events = await prisma.accessEvent.findMany({
                take: 5,
                orderBy: { timestamp: 'desc' },
                include: { user: true, device: true }
            });
            response = `📋 *Últimos 5 Accesos*\n\n`;
            events.forEach((e, i) => {
                const time = new Date(e.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                const userName = e.user?.name || 'Desconocido';
                const decision = e.decision === 'GRANT' ? '✅' : '❌';
                response += `${i + 1}. ${decision} ${userName} - ${time}\n`;
            });
        } else if (lowerBody.includes('quién') || lowerBody.includes('quien')) {
            const recentEntries = await prisma.accessEvent.findMany({
                where: {
                    direction: 'ENTRY',
                    decision: 'GRANT',
                    timestamp: {
                        gte: new Date(Date.now() - 12 * 60 * 60 * 1000) // Last 12 hours
                    }
                },
                include: { user: true },
                orderBy: { timestamp: 'desc' }
            });
            const uniqueUsers = [...new Set(recentEntries.map(e => e.user?.name).filter(Boolean))];
            response = `👥 *Personas en el Edificio*\n\n`;
            if (uniqueUsers.length === 0) {
                response += 'No hay registros recientes de entrada.';
            } else {
                uniqueUsers.forEach((name, i) => {
                    response += `${i + 1}. ${name}\n`;
                });
            }
        } else if (lowerBody.includes('cámara') || lowerBody.includes('camara') || lowerBody.includes('dispositivo')) {
            const devices = await prisma.device.findMany({
                select: { name: true, brand: true, doorStatus: true }
            });
            response = `🎥 *Dispositivos Conectados*\n\n`;
            devices.forEach((d, i) => {
                const status = d.doorStatus === 'OPEN' ? '🔓' : '🔒';
                response += `${i + 1}. ${status} ${d.name} (${d.brand})\n`;
            });
        } else if (lowerBody.includes('abrir')) {
            response = `🚪 *Control de Acceso*\n\n⚠️ Función de apertura remota requiere autenticación adicional.\n\nPor seguridad, esta acción debe realizarse desde el panel web.`;
        } else {
            response = `🤖 No entendí tu mensaje.\n\nEscribe "menu" para ver los comandos disponibles.`;
        }

        // Send response via WAHA
        const headers = {};
        if (wahaApiKey) headers['X-Api-Key'] = wahaApiKey;

        await axios.post(`${wahaUrl}/api/sendText`, {
            session: session || 'default',
            chatId: chatId,
            text: response
        }, { headers });

        console.log(`${logPrefix} [WAHA] Response sent to ${from}`);

        res.writeHead(200);
        res.end('OK');

    } catch (error) {
        console.error(`${logPrefix} [WAHA] Handler Error:`, error);
        res.writeHead(500);
        res.end('Error');
    }
};

module.exports = { handleWahaWebhook };
