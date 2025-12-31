const { createServer } = require("https");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const { Server } = require("socket.io");
const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const Busboy = require("busboy");

const axios = require("axios");
const crypto = require("crypto");
const { uploadToS3 } = require("./lib-s3");
const { getVehicleColorName, getVehicleBrandName } = require("./hikvision-codes");

const prisma = new PrismaClient();
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.WEBHOOK_PORT || "10000", 10);

// Helper for Camera Snapshots (Basic/Digest)
const fetchCameraSnapshot = async (device) => {
    let baseUrl = device.ip.startsWith('http') ? device.ip : `http://${device.ip}`;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    // Determine Snapshot PATH based on brand
    let path = "/fcgi/do?action=Snapshot"; // Default Akuvox
    if (device.brand === 'HIKVISION') {
        path = "/ISAPI/Streaming/channels/1/picture";
    } else if (device.brand === 'DAHUA') {
        path = "/cgi-bin/snapshot.cgi";
    }

    const url = `${baseUrl}${path}`;
    const authHeaderBasic = "Basic " + Buffer.from(`${device.username}:${device.password}`).toString("base64");

    try {
        // Strategy 1: Try Basic
        const response = await axios.get(url, {
            headers: { 'Authorization': authHeaderBasic },
            responseType: 'arraybuffer',
            timeout: 5000
        });
        return response.data;
    } catch (error) {
        // Strategy 2: Try Digest if 401
        if (error.response?.status === 401) {
            const wwwAuth = error.response.headers["www-authenticate"];
            if (wwwAuth && wwwAuth.includes("Digest")) {
                console.log("[Snap] Attempting Digest Auth...");
                try {
                    const getVal = (key) => {
                        const match = wwwAuth.match(new RegExp(`${key}="?([^",]+)"?`));
                        return match ? match[1] : null;
                    };

                    const realm = getVal("realm");
                    const nonce = getVal("nonce");
                    const qop = getVal("qop");
                    const opaque = getVal("opaque");
                    const algorithm = getVal("algorithm") || "MD5";

                    const ha1 = crypto.createHash("md5").update(`${device.username}:${realm}:${device.password}`).digest("hex");
                    const ha2 = crypto.createHash("md5").update(`GET:${path}`).digest("hex");
                    const nc = "00000001";
                    const cnonce = crypto.randomBytes(8).toString("hex");

                    let responseStr;
                    if (qop) {
                        responseStr = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
                    } else {
                        responseStr = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
                    }

                    const authString = `Digest username="${device.username}", realm="${realm}", nonce="${nonce}", uri="${path}", qop="${qop || ''}", nc=${nc}, cnonce="${cnonce}", response="${responseStr}", opaque="${opaque || ''}", algorithm="${algorithm}"`;

                    const retryResponse = await axios.get(url, {
                        headers: { Authorization: authString },
                        responseType: 'arraybuffer',
                        timeout: 5000
                    });
                    return retryResponse.data;
                } catch (e) {
                    console.error("[Snap] Digest failed:", e.message);
                }
            }
        }
        console.warn(`[Snap] Final error from ${device.brand}: ${error.message}`);
        return null;
    }
};

const debounceCache = new Map();
const DEBOUNCE_TIME = 5000;

// Debug Logs History (In-memory)
const debugLogsHistory = [];
const MAX_DEBUG_LOGS = 500;

const addDebugLog = (data) => {
    const log = {
        id: data.id || `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...data
    };
    debugLogsHistory.unshift(log);
    if (debugLogsHistory.length > MAX_DEBUG_LOGS) {
        debugLogsHistory.pop();
    }
    if (global.io) {
        global.io.emit("webhook_debug", log);
    }
    return log;
};

const parseMultipart = (req) => {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const result = { xmlContent: "", jsonContent: "", images: [] };
        const filePromises = [];

        busboy.on('file', (name, file, info) => {
            const { filename, encoding, mimeType } = info;
            console.log(`[Busboy] Part [${name}]: filename=${filename}, mimeType=${mimeType}`);

            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));

            const p = new Promise((res, rej) => {
                file.on('end', () => {
                    const buffer = Buffer.concat(chunks);

                    // Priority 1: Check if it's an image
                    if (mimeType.includes("image") || name.toLowerCase().includes("pic") || name.toLowerCase().includes("image") || name.toLowerCase().includes("capture")) {
                        result.images.push({
                            buffer: buffer,
                            mimeType: mimeType || 'image/jpeg',
                            size: buffer.length,
                            name: name
                        });
                        console.log(`[Busboy] Image captured: ${name} (${buffer.length} bytes)`);
                    }
                    // Priority 2: Inspect content for JSON vs XML (More reliable than name)
                    else {
                        const text = buffer.toString('utf8').trim();
                        if (text.startsWith('{') || text.startsWith('[')) {
                            result.jsonContent = text;
                        } else if (text.startsWith('<')) {
                            result.xmlContent = text;
                        } else {
                            // Fallback based on name/mime if content inspection matches nothing
                            if (mimeType.includes("xml") || name.toLowerCase().includes("xml") || name.toLowerCase().includes("event")) {
                                result.xmlContent = text;
                            } else if (mimeType.includes("json") || name.toLowerCase().includes("json") || name.toLowerCase().includes("alarm")) {
                                result.jsonContent = text;
                            }
                        }
                    }
                    res();
                });
                file.on('error', rej);
            });
            filePromises.push(p);
        });

        busboy.on('field', (name, val) => {
            if (val.trim().startsWith("<")) {
                result.xmlContent = val;
            } else if (val.trim().startsWith("{") || val.trim().startsWith("[")) {
                result.jsonContent = val;
            }
        });

        busboy.on('finish', async () => {
            await Promise.all(filePromises);
            resolve(result);
        });

        busboy.on('error', reject);

        req.pipe(busboy);
    });
};

const handleWebhook = async (req, res, logPrefix) => {
    try {
        console.log(`${logPrefix} === Hikvision Webhook Received ===`);
        const contentType = req.headers['content-type'] || "";

        // Initial placeholder for debug data
        let debugData = {
            id: Date.now().toString(),
            timestamp: new Date(),
            source: 'hikvision',
            method: req.method,
            url: req.url,
            params: { contentType },
            credentialValue: null
        };

        let xmlContent = "";
        let jsonContent = "";
        let images = [];

        if (contentType.includes("multipart/form-data")) {
            const parsed = await parseMultipart(req);
            xmlContent = parsed.xmlContent;
            jsonContent = parsed.jsonContent;
            images = parsed.images;
            if (images.length > 0) console.log(`${logPrefix} [Hik] Multipart images found: ${images.length}`);
            if (jsonContent) console.log(`${logPrefix} [Hik] Multipart JSON metadata found.`);
        } else {
            const buffers = [];
            for await (const chunk of req) {
                buffers.push(chunk);
            }
            const rawBody = Buffer.concat(buffers).toString();
            if (rawBody.trim().startsWith("<")) {
                xmlContent = rawBody;
            } else if (rawBody.trim().startsWith("{")) {
                jsonContent = rawBody;
            }
        }

        if (!xmlContent && !jsonContent) {
            console.error(`${logPrefix} No XML or JSON metadata received`);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "No XML/JSON metadata found" }));
            return;
        }

        // ==========================================
        // PATH A: JSON Content (Likely Face Event)
        // ==========================================
        // Check if it matches FACE event structure
        let jsonData = null;
        let isFaceEvent = false;
        if (jsonContent) {
            try {
                jsonData = JSON.parse(jsonContent);
                // Check if it contains Face Detection data
                const keys = Object.keys(jsonData);
                const hasFaceKeys = jsonData.alarmResult?.[0]?.faces || jsonData.faceMatchResult || jsonData.faces || jsonData.FaceInfo || jsonData.faceInfo;
                // Also check eventType
                const evtType = jsonData.eventType || jsonData.alarmResult?.eventType;

                if (hasFaceKeys || (evtType && evtType.toLowerCase().includes('face'))) {
                    isFaceEvent = true;
                } else {
                    console.log(`${logPrefix} [Hik] JSON metadata found but does not look like Face Event. Keys: ${keys.join(', ')}. Falling back to XML/LPR.`);
                }
            } catch (e) {
                console.error(`${logPrefix} [Hik] JSON parse error: ${e.message}. Falling back to XML/LPR.`);
            }
        }

        // ==========================================
        // PATH A: JSON Content (Likely Face Event)
        // ==========================================
        if (isFaceEvent && jsonData) {
            console.log(`${logPrefix} [DEBUG-JSON] Processing as FACE Event.`);

            // Normalización de Datos de Rostro
            const alarmData = jsonData.alarmResult?.[0] || jsonData.faceMatchResult || jsonData;
            const faceData = alarmData.faces?.[0] || alarmData.faceInfo || {};
            const identifyData = faceData.identify?.[0] || {};
            const candidate = identifyData.candidate?.[0] || {}; // Mejor coincidencia

            // Determinar Tipo de Evento
            const eventType = jsonData.eventType || alarmData.eventType || "faceCapture";
            // Lógica de Matching
            const isMatch = candidate.similarity && candidate.similarity > 70; // Hard threshold or just existence? 
            // The user said: "Solo debes almacenar los rostros que coinciden con la lista". 
            // Often un-matched faces have no candidate or very low similarity.
            // Hikvision usually sends 'blackList' or 'whiteList' type if matched.

            const personName = (candidate.reserve_field?.name || candidate.name || "").trim();
            const similarity = candidate.similarity ? Math.floor(candidate.similarity * 100) : 0;

            console.log(`${logPrefix} 👤 [FACE] Event: ${eventType}, Name: '${personName}', Sim: ${similarity}%`);

            // --- FILTER: Only Store Matches ---
            if (!personName || personName === "msg.unknown" || personName === "unknown" || personName === "") {
                console.log(`${logPrefix} 🚫 [FILTER] Ignored non-matched face (Name: ${personName || 'Empty'}).`);
                res.writeHead(200);
                res.end(JSON.stringify({ status: "ignored", reason: "No match" }));
                return;
            }

            // Debug Data Enrichment
            debugData.credentialValue = personName;
            debugData.status = 200;

            // --- Find Device ---
            const macAddress = jsonData.macAddress || alarmData.macAddress || jsonData.mac || null;
            const ipAddress = jsonData.ipAddress || alarmData.ipAddress || jsonData.ip || null;
            const eventTimestamp = jsonData.dateTime ? new Date(jsonData.dateTime) : new Date();

            const normalizeMac = (m) => m ? m.replace(/[:-\s]/g, "").toUpperCase() : null;
            let device = null;
            const cleanIncomingMac = normalizeMac(macAddress);

            if (cleanIncomingMac) {
                const allDevices = await prisma.device.findMany();
                device = allDevices.find(d => normalizeMac(d.mac) === cleanIncomingMac);
            }
            if (!device && ipAddress) {
                device = await prisma.device.findFirst({ where: { ip: ipAddress } });
            }

            // --- Process Images (Full vs Face) ---
            let fullImagePath = "";
            let faceImagePath = "";

            if (images.length > 0) {
                // Sort by size: Largest is usually Full/Background, Smallest is Face Crop
                images.sort((a, b) => b.size - a.size);

                const fullImg = images[0];
                const faceImg = images.length > 1 ? images[images.length - 1] : null;

                try {
                    // Upload Full (Using 'lpr' bucket to ensure compatibility with existing file viewer)
                    const fnameFull = `hik_face_full_${Date.now()}_${personName.replace(/\s+/g, '_')}.jpg`;
                    fullImagePath = await uploadToS3(fullImg.buffer, fnameFull, fullImg.mimeType, "lpr");
                    console.log(`${logPrefix} [S3] Full image uploaded: ${fullImagePath}`);

                    // Upload Face Crop (if exists)
                    if (faceImg) {
                        const fnameFace = `hik_face_crop_${Date.now()}_${personName.replace(/\s+/g, '_')}.jpg`;
                        faceImagePath = await uploadToS3(faceImg.buffer, fnameFace, faceImg.mimeType, "lpr");
                        console.log(`${logPrefix} [S3] Face crop uploaded: ${faceImagePath}`);
                    }
                } catch (imgError) {
                    console.error(`${logPrefix} [S3] Upload FAILED: ${imgError.message}`);
                }
            }

            // --- Find User (if matched) ---
            let credentialId = null;
            let userId = null;
            // let user = null; // Defined in prisma block below

            // Try to find the user in our DB by name
            const user = await prisma.user.findFirst({ where: { name: personName } });
            if (user) {
                userId = user.id;
                // Find or create a FACE credential placeholder if needed
                const cred = await prisma.credential.findFirst({ where: { userId: user.id, type: 'FACE' } });
                if (cred) credentialId = cred.id;
            }

            // --- Create Event ---
            const event = await prisma.accessEvent.create({
                data: {
                    deviceId: device ? device.id : null,
                    credentialId,
                    userId,
                    timestamp: eventTimestamp,
                    accessType: 'FACE',
                    direction: device?.direction || "ENTRY",
                    decision: "GRANT", // Matches are granted
                    snapshotPath: fullImagePath, // Store FULL image as main snapshot
                    plateDetected: null,
                    plateNumber: null,
                    // Store extra details including Face Crop Path
                    details: `Rostro: ${personName}, Similitud: ${similarity}%, ${faceImagePath ? 'FaceImage:' + faceImagePath : ''}`
                }
            });

            // --- Notify UI ---
            if (global.io) {
                global.io.emit("access_event", {
                    ...event,
                    device,
                    user,
                    direction: event.direction
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: "processed", type: "FACE", decision: "GRANT" }));
            return;
        }

        // ==========================================
        // PATH B: XML Content (LPR / ANPR)
        // ==========================================

        // Parse XML
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        const xmlData = parser.parse(xmlContent);

        // DEBUG: Log the keys of the parsed XML to see the structure
        console.log(`${logPrefix} [DEBUG-XML] Root keys: ${Object.keys(xmlData).join(', ')}`);

        // Extract Data
        let eventAlert = xmlData.EventNotificationAlert || xmlData;

        // If it's a nested structure like { EventNotificationAlert: { ... } }
        if (xmlData.EventNotificationAlert) {
            eventAlert = xmlData.EventNotificationAlert;
        }

        const macAddress = xmlData.macAddress || eventAlert.macAddress || eventAlert.ANPR?.macAddress || eventAlert['@_macAddress'];
        const ipAddress = xmlData.ipAddress || eventAlert.ipAddress || eventAlert.ANPR?.ipAddress || eventAlert['@_ipAddress'];

        const plateNumber = xmlData.ANPR?.licensePlate ||
            eventAlert.ANPR?.licensePlate ||
            xmlData.licensePlate ||
            eventAlert.licensePlate ||
            xmlData.EventNotificationAlert?.ANPR?.licensePlate;

        // --- HANDLE HIKVISION NON-EVENT MESSAGES (Heartbeats / Tests / Stun) ---
        const eventType = xmlData.eventType || eventAlert.eventType || "";
        const isHeartbeat = eventType.toLowerCase().includes('heartbeat') ||
            xmlContent.toLowerCase().includes('heartbeat') ||
            xmlContent.toLowerCase().includes('stun');

        if (!plateNumber) {
            if (isHeartbeat) {
                // UPDATE: Track push connection for heartbeats too
                const cleanIncomingMac = macAddress ? macAddress.replace(/[:-\s]/g, "").toUpperCase() : null;
                if (cleanIncomingMac || ipAddress) {
                    await prisma.device.updateMany({
                        where: {
                            OR: [
                                { mac: { contains: cleanIncomingMac } },
                                { ip: ipAddress }
                            ]
                        },
                        data: { lastOnlinePush: new Date() }
                    }).catch(e => console.error(`${logPrefix} Error updating heartbeat: ${e.message}`));
                }

                // Return silently for heartbeats - no log spam, no socket emission
                res.writeHead(200);
                res.end(JSON.stringify({ status: "ok", type: "heartbeat" }));
                return;
            }

            // If it's a known non-plate message, we still emit debug but don't log error
            addDebugLog({ ...debugData, status: 200, credentialValue: "NON-ANPR" });

            console.warn(`${logPrefix} ℹ️ Webhook received without plate (possible test or non-ANPR event)`);
            res.writeHead(200);
            res.end(JSON.stringify({ status: "ok", message: "Ignored: No plate found" }));
            return;
        }

        // Enrich debug data with the plate

        // Extraer Metadatos Adicionales (Color, Tipo, Marca, Decisión de Cámara)
        // Hikvision guarda la info del vehículo en el objeto vehicleInfo
        const vehicleInfo = xmlData.ANPR?.vehicleInfo || eventAlert.ANPR?.vehicleInfo || {};

        // Extraer color - Hikvision envía AMBOS: código numérico Y texto
        const colorCode = vehicleInfo.colorDepth ||
            vehicleInfo.vehicleColor ||
            xmlData.ANPR?.vehicleColor ||
            eventAlert.ANPR?.vehicleColor;

        const colorText = vehicleInfo.color ||
            xmlData.ANPR?.color ||
            eventAlert.ANPR?.color;

        const brandCode = vehicleInfo.vehicleLogoRecog ||
            vehicleInfo.vehicleLogo ||
            vehicleInfo.vehicleBrand ||
            vehicleInfo.brand ||
            xmlData.ANPR?.vehicleLogo ||
            eventAlert.ANPR?.vehicleLogo ||
            xmlData.ANPR?.vehicleBrand ||
            eventAlert.ANPR?.vehicleBrand;

        // Mapeo de colores en inglés a español
        const COLOR_TEXT_MAP = {
            'white': 'Blanco',
            'silver': 'Plateado',
            'gray': 'Gris',
            'grey': 'Gris',
            'black': 'Negro',
            'red': 'Rojo',
            'blue': 'Azul',
            'darkblue': 'Azul Oscuro',
            'yellow': 'Amarillo',
            'green': 'Verde',
            'brown': 'Marrón',
            'pink': 'Rosa',
            'purple': 'Púrpura',
            'cyan': 'Cian',
            'orange': 'Naranja'
        };

        // Priorizar el texto directo sobre el código numérico
        let vehicleColor = "Unknown";
        if (colorText && COLOR_TEXT_MAP[colorText.toLowerCase()]) {
            vehicleColor = COLOR_TEXT_MAP[colorText.toLowerCase()];
        } else if (colorCode) {
            vehicleColor = getVehicleColorName(colorCode);
        }

        const vehicleBrand = brandCode ? getVehicleBrandName(brandCode) : "Unknown";

        const vehicleType = xmlData.ANPR?.vehicleType || eventAlert.ANPR?.vehicleType || "Unknown";

        const vehicleModel = vehicleInfo.vehicleModel ||
            vehicleInfo.vehileModel || // Typo en la API de Hikvision
            vehicleInfo.model ||
            xmlData.ANPR?.vehicleModel ||
            eventAlert.ANPR?.vehicleModel ||
            "Unknown";

        // Guardar TODOS los datos ANPR para futuras implementaciones
        const rawAnprData = {
            ...eventAlert.ANPR,
            vehicleInfo: vehicleInfo,
            codes: {
                colorCode,
                colorText,
                brandCode
            }
        };

        // DEBUG: Log all ANPR fields to identify correct field names
        console.log(`${logPrefix} 🔍 [DEBUG-ANPR] Extracted values:`, {
            color: vehicleColor,
            type: vehicleType,
            brand: vehicleBrand,
            model: vehicleModel
        });

        // Match Info desde la cámara (Si la cámara ya decidió)
        // Estructura usual: eventAlert.ANPR.originalLicensePlate o matches...
        // A veces viene en <ListName> o <ListType> dentro de matchInfo
        // Buscamos en varios lugares posibles según firmware

        let cameraDecision = null;

        // Método 1: Buscar en matches/matchInfo
        const matchList = eventAlert.ANPR?.matches || eventAlert.matches || eventAlert.ANPR?.matchInfo || eventAlert.matchInfo;
        if (matchList) {
            // Puede ser un array o un objeto único
            const matchInfo = Array.isArray(matchList) ? matchList[0] : matchList;
            console.log(`${logPrefix} 🔍 [MATCH-INFO] matchInfo:`, matchInfo);

            if (matchInfo) {
                // Verificar diferentes variantes de campo
                const listType = matchInfo.listType || matchInfo.ListType || matchInfo.type;
                const listName = matchInfo.listName || matchInfo.ListName || matchInfo.name;

                console.log(`${logPrefix} 🔍 [MATCH-INFO] listType: ${listType}, listName: ${listName}`);

                if (listType === 'whiteList' || listType === 'WhiteList' || listName === 'whiteList' || listName === 'WhiteList') {
                    cameraDecision = "GRANT";
                    console.log(`${logPrefix} ✅ [WHITELIST] Detected from camera - GRANT`);
                } else if (listType === 'blackList' || listType === 'BlackList' || listName === 'blackList' || listName === 'BlackList') {
                    cameraDecision = "DENY";
                    console.log(`${logPrefix} ❌ [BLACKLIST] Detected from camera - DENY`);
                }
            }
        }

        // Método 2: Buscar directamente en ANPR
        if (!cameraDecision) {
            const anprListType = eventAlert.ANPR?.listType || eventAlert.ANPR?.ListType;
            const anprListName = eventAlert.ANPR?.listName || eventAlert.ANPR?.ListName;
            const vehicleListName = eventAlert.ANPR?.vehicleListName; // Campo específico de Hikvision

            if (anprListType || anprListName || vehicleListName) {
                console.log(`${logPrefix} 🔍 [ANPR-LIST] listType: ${anprListType}, listName: ${anprListName}, vehicleListName: ${vehicleListName}`);

                // Verificar vehicleListName primero (más específico)
                if (vehicleListName) {
                    const listNameLower = vehicleListName.toLowerCase();
                    if (listNameLower.includes('white') || listNameLower.includes('allow') || listNameLower.includes('blanca') || listNameLower.includes('permitida')) {
                        cameraDecision = "GRANT";
                        console.log(`${logPrefix} ✅ [WHITELIST] Detected from vehicleListName: ${vehicleListName} - GRANT`);
                    } else if (listNameLower.includes('black') || listNameLower.includes('block') || listNameLower.includes('negra') || listNameLower.includes('bloqueada')) {
                        cameraDecision = "DENY";
                        console.log(`${logPrefix} ❌ [BLACKLIST] Detected from vehicleListName: ${vehicleListName} - DENY`);
                    } else if (listNameLower.includes('other')) {
                        console.log(`${logPrefix} ℹ️ [OTHER-LIST] Plate on 'otherList' (Common for unknown plates) - Will check DB`);
                    }
                }

                // Si no se detectó por vehicleListName, verificar otros campos
                if (!cameraDecision && (anprListType === 'whiteList' || anprListType === 'WhiteList' || anprListName === 'whiteList' || anprListName === 'WhiteList')) {
                    cameraDecision = "GRANT";
                    console.log(`${logPrefix} ✅ [WHITELIST] Detected from ANPR - GRANT`);
                } else if (!cameraDecision && (anprListType === 'blackList' || anprListType === 'BlackList' || anprListName === 'blackList' || anprListName === 'BlackList')) {
                    cameraDecision = "DENY";
                    console.log(`${logPrefix} ❌ [BLACKLIST] Detected from ANPR - DENY`);
                }
            }
        }

        if (!cameraDecision) {
            console.log(`${logPrefix} ⚠️ [NO-CAMERA-DECISION] Camera did not send whitelist/blacklist info`);
            console.log(`${logPrefix} ⚠️ [NO-CAMERA-DECISION] Event will be marked as UNKNOWN - manual review required`);
        }

        const cleanPlate = plateNumber.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
        const isUnknown = cleanPlate === "UNKNOWN" || cleanPlate === "";
        const finalPlate = isUnknown ? "NO_LEIDA" : cleanPlate;

        // Enrich debug data with the plate
        debugData.credentialValue = finalPlate;

        // Timestamp
        let eventTimestamp = new Date();
        const cameraDateTime = xmlData.dateTime || eventAlert.dateTime;
        if (cameraDateTime) {
            try {
                eventTimestamp = new Date(cameraDateTime);
            } catch (e) {
                eventTimestamp = new Date();
            }
        }

        // Debounce
        const now = Date.now();
        const lastSeen = debounceCache.get(finalPlate);
        if (lastSeen && now - lastSeen < DEBOUNCE_TIME) {
            console.log(`${logPrefix} Debounced: ${finalPlate}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: "Debounced", plate: finalPlate }));
            return;
        }
        debounceCache.set(finalPlate, now);

        // Save Image to S3 (MinIO)
        // Save Image to S3 (MinIO)
        let relativeImagePath = "";

        // Sort images by size to pick the largest (Full Scene) instead of the crop
        if (images.length > 1) {
            images.sort((a, b) => b.size - a.size);
        }
        const imageFile = images.length > 0 ? images[0] : null;

        if (imageFile) {
            try {
                const filename = `hik_${finalPlate}_${eventTimestamp.getTime()}.jpg`;
                console.log(`${logPrefix} [S3] Attempting upload of ${imageFile.size} bytes to bucket 'lpr'...`);
                relativeImagePath = await uploadToS3(imageFile.buffer, filename, imageFile.mimeType || "image/jpeg", "lpr");
                console.log(`${logPrefix} [S3] Upload SUCCESS: ${relativeImagePath}`);
            } catch (imgError) {
                console.error(`${logPrefix} [S3] Upload FAILED: ${imgError.message}`);
                // Fallback to empty to avoid crashing but log it clearly
            }
        } else {
            console.warn(`${logPrefix} [S3] Skip upload: No image part in webhook.`);
        }

        // Helper to normalize MAC (removes colons, dashes, and makes uppercase)
        const normalizeMac = (m) => m ? m.replace(/[:-\s]/g, "").toUpperCase() : null;

        // Find Device - Strategic lookup
        let device = null;
        const cleanIncomingMac = normalizeMac(macAddress);

        if (cleanIncomingMac) {
            const allDevices = await prisma.device.findMany();
            device = allDevices.find(d => normalizeMac(d.mac) === cleanIncomingMac);
        }

        if (!device && ipAddress) {
            device = await prisma.device.findFirst({ where: { ip: ipAddress } });
        }

        if (!device) {
            // Last resort: find any Hikvision device if we only have one
            const hikDevices = await prisma.device.findMany({ where: { brand: 'HIKVISION' } });
            if (hikDevices.length === 1) {
                device = hikDevices[0];
                console.log(`${logPrefix} [RECOVERY] Auto-matched to the only available Hikvision device: ${device.name}`);
            }
        }

        // UPDATE: Track push connection for actual events
        if (device) {
            await prisma.device.update({
                where: { id: device.id },
                data: { lastOnlinePush: new Date() }
            }).catch(e => { });
        }

        // Finalize debug emission for ACTUAL events
        addDebugLog({
            ...debugData,
            status: 200,
            deviceName: device?.name,
            deviceMac: macAddress || device?.mac
        });

        // Create Event Logic
        // ACCESS LOGIC: Prioritize Camera Decision (allowList/whiteList)
        // Fallback to local DB if camera doesn't provide decision
        let accessDecision = cameraDecision;
        let credentialId = null;
        let userId = null;

        // Search for plate in local database to enrich event and as fallback
        console.log(`${logPrefix} 🔍 [DB-SEARCH] Searching for plate: "${finalPlate}" (type: PLATE)`);
        const credential = !isUnknown ? await prisma.credential.findFirst({
            where: {
                type: 'PLATE',
                value: finalPlate
            },
            include: { user: true }
        }) : null;

        if (credential) {
            const user = credential.user;
            credentialId = credential.id;
            userId = user.id;

            if (!accessDecision) {
                accessDecision = "GRANT";
                console.log(`${logPrefix} ✅ [DB-DECISION] Camera silent, Plate found in DB (User: ${user.name}) - GRANT`);
            } else {
                console.log(`${logPrefix} ℹ️ [DB-INFO] Plate found in DB (User: ${user.name}), but using Camera Decision: ${accessDecision}`);
            }
        } else {
            if (!accessDecision) {
                accessDecision = "DENY";
                console.log(`${logPrefix} ❌ [DB-DECISION] Camera silent, Plate NOT found in DB - DENY`);
            } else {
                console.log(`${logPrefix} ℹ️ [DB-INFO] Plate NOT found in DB, but using Camera Decision: ${accessDecision}`);
            }
        }

        // Persist Event
        const event = await prisma.accessEvent.create({
            data: {
                deviceId: device ? device.id : null,
                credentialId,
                userId,
                timestamp: eventTimestamp,
                accessType: 'PLATE',
                direction: device?.direction || "ENTRY",
                decision: accessDecision || "DENY", // If still null after DB check, default to DENY
                snapshotPath: relativeImagePath,
                plateNumber: finalPlate,
                plateDetected: finalPlate, // Ensure we fill both
                details: `${isUnknown ? 'ALERTA: Matrícula No Reconocida. ' : ''}Marca: ${vehicleBrand}, Modelo: ${vehicleModel}, Color: ${vehicleColor}, Tipo: ${vehicleType}, Source: ${cameraDecision ? 'Camera' : 'Server'}`
            }
        });

        console.log(`${logPrefix} Event created: ${event.id} (${accessDecision}) - Plate: ${finalPlate}`);

        // Notify UI
        if (global.io) {
            console.log(`${logPrefix} [SOCKET] Emitting access_event for plate: ${cleanPlate}`);
            global.io.emit("access_event", {
                ...event,
                device,
                user: credential ? credential.user : null,
                direction: event.direction // Ensure direction is explicitly sent
            });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "processed", decision: accessDecision }));

    } catch (error) {
        console.error(`${logPrefix} Webhook Error:`, error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
}

const handleAkuvoxWebhook = async (req, res, logPrefix) => {
    try {
        console.log(`${logPrefix} === Akuvox Webhook Received ===`);
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        const params = Object.fromEntries(parsedUrl.searchParams);

        console.log(`${logPrefix} Akuvox Params:`, params);

        // Required params based on our spec
        let eventType = params.event;
        const macAddress = params.mac;
        const cardNumber = params.card;

        // Normalización de eventos según recomendación en docs/akuvox/AKUVOX_CALLBACKS.md
        // Soporta eventos directos (event=door_open) o anidados (event=relay&status=open)
        if (eventType === 'relay') {
            eventType = params.status === 'open' ? 'door_open' : 'door_close';
        } else if (eventType === 'card') {
            eventType = params.type === 'invalid' ? 'card_invalid' : 'card_valid';
        } else if (eventType === 'face') {
            eventType = params.type === 'invalid' ? 'face_invalid' : 'face_valid';
        } else if (eventType === 'code') {
            eventType = params.type === 'invalid' ? 'code_invalid' : 'code_valid';
        }

        // Eventos de sistema (si vienen por el parámetro event directamente)
        // Ejemplos: tamper, calling, login_fail, motion

        if (!macAddress) {
            console.warn(`${logPrefix} Akuvox webhook missing MAC`);
            res.writeHead(400);
            res.end("Missing MAC");
            return;
        } else {
            const allDevices = await prisma.device.findMany({ where: { brand: 'AKUVOX' } });
            const normalizeMac = (m) => m ? m.replace(/[:-\s]/g, "").toUpperCase() : null;
            const cleanIncomingMac = normalizeMac(macAddress);
            const device = allDevices.find(d => normalizeMac(d.mac) === cleanIncomingMac);
            if (device) {
                await prisma.device.update({
                    where: { id: device.id },
                    data: { lastOnlinePush: new Date() }
                }).catch(e => { });
            }
        }

        // Helper to normalize MAC (moved here for broader scope if needed, but also defined above)
        const normalizeMac = (m) => m ? m.replace(/[:-\s]/g, "").toUpperCase() : null;
        const cleanMac = normalizeMac(macAddress);

        // Find Device
        const allDevices = await prisma.device.findMany();
        let device = allDevices.find(d => normalizeMac(d.mac) === cleanMac);

        // Emit debug event for monitoring (after finding device)
        addDebugLog({
            id: Date.now().toString(),
            timestamp: new Date(),
            source: 'akuvox',
            method: req.method,
            url: req.url,
            params: params,
            deviceName: device?.name || 'Dispositivo Desconocido',
            deviceMac: macAddress,
            credentialValue: params.card || params.user || params.name || params.code || eventType
        });

        if (!device) {
            console.warn(`${logPrefix} Unknown Akuvox Device MAC: ${macAddress}`);
        }

        let accessDecision = "DENY";
        let credentialType = null;
        let credentialValue = null;
        let userId = null;
        let user = null;
        let details = "";
        let snapPath = null; // Defined here for all logic types

        // Process Event Type
        if (eventType === 'door_open') {
            // Door opened remotely or manually
            console.log(`${logPrefix} Door Open Event from ${macAddress}`);
            details = `Puerta Abierta (${params.id || 'Relay A'})`;
            accessDecision = "GRANT";
            credentialType = "TAG";
            credentialValue = "DOOR_OPEN";

            if (device) {
                try {
                    await prisma.device.update({
                        where: { id: device.id },
                        data: { doorStatus: 'OPEN' }
                    });
                } catch (e) { console.error("Error updating door status:", e); }
            }

            if (global.io) {
                global.io.emit("device_status", {
                    deviceId: device?.id,
                    mac: macAddress,
                    doorStatus: 'open',
                    timestamp: new Date()
                });
            }

        } else if (eventType === 'door_close') {
            console.log(`${logPrefix} Door Close Event from ${macAddress}`);
            details = `Puerta Cerrada`;
            accessDecision = "GRANT";
            credentialType = 'TAG';
            credentialValue = 'DOOR_CLOSE';

            if (device) {
                try {
                    await prisma.device.update({
                        where: { id: device.id },
                        data: { doorStatus: 'CLOSED' }
                    });
                } catch (e) { console.error("Error updating door status:", e); }
            }

            if (global.io) {
                global.io.emit("device_status", {
                    deviceId: device?.id,
                    mac: macAddress,
                    doorStatus: 'closed',
                    timestamp: new Date()
                });
            }

        } else if (eventType === 'card_valid') {
            credentialType = 'TAG';
            credentialValue = cardNumber;
            accessDecision = "GRANT";
            details = `Tarjeta RFID Válida: ${cardNumber}`;

        } else if (eventType === 'card_invalid') {
            credentialType = 'TAG';
            credentialValue = cardNumber;
            accessDecision = "DENY";
            details = `Tarjeta RFID Inválida: ${cardNumber}`;

        } else if (eventType === 'face_valid' || eventType === 'face_invalid') {
            const isSuccess = eventType === 'face_valid';
            credentialType = 'FACE';

            // Filter out device macros that weren't replaced ($name, $user, etc)
            const rawValue = params.user || params.name || (isSuccess ? "Unknown" : "Desconocido");
            credentialValue = rawValue.startsWith('$') ? "No Identificado" : rawValue;

            accessDecision = isSuccess ? "GRANT" : "DENY";
            details = isSuccess ? `Rostro Reconocido: ${credentialValue}` : `Rostro No Identificado`;

            // ATOMIC CAPTURE ON FACE EVENT
            if (device) {
                console.log(`${logPrefix} [AUTO-SNAP] Triggering snapshot for face event from ${device.name}`);
                const snapBuffer = await fetchCameraSnapshot(device);
                if (snapBuffer) {
                    try {
                        const filename = `aku_face_${device.id}_${Date.now()}.jpg`;
                        snapPath = await uploadToS3(snapBuffer, filename, "image/jpeg", "face");
                        details += " (Evidencia capturada en S3)";
                    } catch (e) {
                        console.error("Error uploading face snapshot to S3:", e.message);
                    }
                }
            }

        } else if (eventType === 'code_valid') {
            credentialType = 'PIN';
            credentialValue = params.code;
            accessDecision = "GRANT";
            details = `Código PIN Válido: ${params.code}`;

        } else if (eventType === 'code_invalid') {
            credentialType = 'PIN';
            credentialValue = params.code || "XXXX";
            accessDecision = "DENY";
            details = `Código PIN Inválido: ${credentialValue}`;

        } else if (eventType === 'tamper') {
            details = `¡ALERTA!: Sensor Tamper activado (Sabotaje detectado)`;
            accessDecision = "DENY";
            credentialType = 'TAG';
            credentialValue = 'ALARM_TAMPER';

        } else if (eventType === 'calling' || eventType === 'invite' || eventType === 'call_created') {
            details = `Llamada entrante a: ${params.to || 'Central'}`;
            accessDecision = "GRANT";
            credentialType = 'TAG';
            credentialValue = 'CALL_START';

            // ATOMIC CAPTURE ON CALL
            if (device) {
                console.log(`${logPrefix} [AUTO-SNAP] Triggering snapshot for call from ${device.name}`);
                const snapBuffer = await fetchCameraSnapshot(device);
                if (snapBuffer) {
                    try {
                        const filename = `aku_call_${device.id}_${Date.now()}.jpg`;
                        snapPath = await uploadToS3(snapBuffer, filename, "image/jpeg", "face");
                        details += " (Foto S3 capturada)";
                    } catch (e) {
                        console.error("Error uploading call snapshot to S3:", e.message);
                    }
                }
            }

            if (global.io) {
                global.io.emit("device_call", { mac: macAddress, to: params.to, timestamp: new Date(), snapshot: snapPath });
            }

        } else {
            console.warn(`${logPrefix} Unknown Akuvox event: ${eventType}`);
            details = `Evento Desconocido: ${eventType}`;
            accessDecision = "DENY";
        }

        // Try to find user by credential
        if (credentialValue && credentialType) {
            const credential = await prisma.credential.findFirst({
                where: {
                    value: credentialValue,
                    type: credentialType
                },
                include: { user: true }
            });

            if (credential) {
                user = credential.user;
                userId = user.id;
                details += ` - User: ${user.name}`;
            }
        }

        // Persist Access Event
        if (device) {
            const event = await prisma.accessEvent.create({
                data: {
                    deviceId: device.id,
                    timestamp: new Date(),
                    accessType: credentialType || (eventType.includes('face') ? 'FACE' : 'TAG'),
                    direction: device.direction || "ENTRY",
                    decision: accessDecision,
                    userId: userId,
                    details: details,
                    plateDetected: credentialValue, // Use this for ID/Tag display if no plate
                    plateNumber: null,
                    snapshotPath: snapPath || null
                }
            });

            // Notify UI via WebSocket
            if (global.io) {
                console.log(`${logPrefix} [SOCKET] Emitting access_event for Akuvox event: ${eventType}`);
                global.io.emit("access_event", {
                    ...event,
                    device,
                    user,
                    direction: event.direction // Ensure direction is explicitly sent
                });
            }

            console.log(`${logPrefix} Akuvox Event Logged: ${event.id} - ${eventType} - ${accessDecision}`);
        } else {
            console.warn(`${logPrefix} Event skipped - Device not found in DB (MAC: ${macAddress})`);
        }

        res.writeHead(200);
        res.end("OK");

    } catch (error) {
        console.error(`${logPrefix} Akuvox Handler Error:`, error);
        res.writeHead(500);
        res.end("Error");
    }
};

const requestHandler = async (req, res) => {
    const logPrefix = `[${new Date().toISOString()}]`;
    const remoteIp = req.socket.remoteAddress;
    // --- LOG ALL REQUESTS (EXTREMELY LOUD FOR DEBUGGING) ---
    console.log(`${logPrefix} 📥 [REQUEST] ${req.method} ${req.url} from ${remoteIp}`);

    // Emit initial debug to socket so we can see arrival even if it fails later
    addDebugLog({
        id: `raw-${Date.now()}`,
        timestamp: new Date(),
        source: 'raw',
        method: req.method,
        url: req.url,
        params: { remoteIp, headers: req.headers },
        credentialValue: "INCOMING POLLING"
    });

    // Health check
    if (req.url === '/health' || req.url === '/ping') {
        res.writeHead(200);
        res.end('OK');
        return;
    }

    // Ignorar rutas de Socket.IO (el motor las intercepta automáticamente, 
    // pero evitamos que lleguen al 404 final o que ensucien el log)
    if (req.url.includes('/socket.io/')) {
        return;
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- ROUTING LOGIC (SOPORTE ULTRA-PERMISIVO) ---
    const url = req.url.toLowerCase();

    // LIVE PROXY (Para ver cámaras remotas en el navegador)
    if (url.includes('/api/live/')) {
        console.log(`${logPrefix} 🎯 Match: LIVE Proxy (Path: ${req.url})`);
        // Extraer el ID limpiamente (sin query params ni slashes extras)
        const parts = req.url.split('/');
        const rawId = parts[parts.length - 1] || parts[parts.length - 2];
        const deviceId = rawId.split('?')[0];

        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!device) {
            console.error(`${logPrefix} [LIVE] Device not found for ID: ${deviceId}`);
            res.writeHead(404);
            res.end("Device not found");
            return;
        }

        console.log(`${logPrefix} [LIVE] Proxying for ${device.name} (${device.ip})`);

        // MJPEG/Snapshot Proxy loop
        res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
            'Cache-Control': 'no-cache',
            'Connection': 'close',
            'Pragma': 'no-cache'
        });

        const sendFrames = async () => {
            while (!req.socket.destroyed) {
                const buffer = await fetchCameraSnapshot(device);
                if (buffer) {
                    res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${buffer.length}\r\n\r\n`);
                    res.write(buffer);
                    res.write('\r\n');
                }
                await new Promise(r => setTimeout(r, 200)); // ~5 fps
            }
        };
        sendFrames();
        return;
    }

    // HIKVISION (LPR)
    if (url.includes('hikvision')) {
        console.log(`${logPrefix} 🎯 Match: HIKVISION Driver (Path: ${req.url})`);
        await handleWebhook(req, res, logPrefix);
        return;
    }

    // AKUVOX (FACE/TAG/DOOR)
    if (url.includes('akuvox')) {
        console.log(`${logPrefix} 🎯 Match: AKUVOX Driver (Path: ${req.url})`);
        await handleAkuvoxWebhook(req, res, logPrefix);
        return;
    }

    // OTROS (Solo log para identificar qué llega)
    if (url.includes('webhook') || url.includes('event')) {
        console.warn(`${logPrefix} ❓ Webhook detectado pero no coincide con marca específica: ${req.url}`);
    }

    console.log(`${logPrefix} ⚠️  404 Not Found: ${req.method} ${req.url}`);
    res.writeHead(404);
    res.end();
};

const httpServer = http.createServer(requestHandler);

// NOTA: Unificamos Socket.IO en el mismo puerto 10000
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Send history to new connection
    if (debugLogsHistory.length > 0) {
        console.log(`Sending ${debugLogsHistory.length} debug logs to client ${socket.id}`);
        socket.emit("webhook_history", debugLogsHistory);
    }
});

global.io = io;

// Escuchamos en todas las interfaces explícitamente ("0.0.0.0")
httpServer.listen(port, "0.0.0.0", () => {
    console.log(`\n🚀 SERVIDOR UNIFICADO ACTIVO EN EL PUERTO ${port}`);
    console.log(`> LPR/Face Webhooks: http://[TU_IP]:${port}/api/webhooks/...`);
    console.log(`> WebSockets: ws://[TU_IP]:${port}`);
    console.log(`> Registro de conexiones activado para diagnóstico.\n`);
});


