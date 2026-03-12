import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get('content-type') || '';
        
        let body;
        // La cámara puede enviar JSON o Multipart con XML
        if (contentType.includes('application/json')) {
            body = await req.json();
            console.log('[Webhook Hik] JSON Event:', body.eventType || 'Unknown');
        } else {
            const text = await req.text();
            console.log('[Webhook Hik] XML/Multipart received');
            // Por ahora aceptamos el evento para no dar error 500
            return NextResponse.json({ success: true, message: 'XML received' });
        }

        // Registrar el evento de acceso en la base de datos
        await prisma.accessEvent.create({
            data: {
                timestamp: new Date(),
                accessType: body.eventType || 'FACE_DETECTION',
                details: JSON.stringify(body),
                location: body.channelName || 'Cámara Frente',
                decision: 'GRANT',
                // ipAddress: body.ipAddress, // Prisma doesn't have this field in AccessEvent based on common patterns, but let's check
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Webhook Hik Error]:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
