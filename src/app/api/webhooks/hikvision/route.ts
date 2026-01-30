import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";
import { uploadToS3 } from "@/lib/s3";
import { AccessDecision } from "@prisma/client";
import { getVehicleBrandName } from "@/lib/hikvision-codes";
import { sendWahaText, sendWahaImage } from "@/lib/whatsapp";
import { getSetting } from "@/app/actions/settings";

const debounceCache = new Map<string, number>();
const DEBOUNCE_TIME = 5000;

// Helpers for formatted S3 filenames
const formatEventDate = (date: Date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year}-${hours}-${minutes}`;
};

const sanitizeName = (name: string | null | undefined) => {
    return (name || "unknown").toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

const generateId = () => {
    return Math.random().toString(36).substring(2, 9);
};

// Simple GET endpoint for testing
export async function GET(req: NextRequest) {
    return NextResponse.json({
        status: "ok",
        message: "Hikvision webhook endpoint is active",
        timestamp: new Date().toISOString()
    });
}

export async function POST(req: NextRequest) {
    const logPrefix = `[HIK-${Date.now()}]`;
    const eventId = generateId();
    let logDetails = "";

    try {
        console.log(`${logPrefix} === Hikvision Webhook Received === `);

        const contentType = req.headers.get("content-type") || "";
        console.log(`${logPrefix} Content - Type: ${contentType} `);

        let xmlContent = "";
        let imageFile: File | null = null;
        let xmlData: any = null;

        // Handle multipart/form-data (como lo hace el PHP)
        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            logDetails += "MULTIPART_RECEIVED\\n";

            for (const [key, value] of formData.entries()) {
                if (value instanceof File) {
                    const fileContent = await value.text();

                    // Check if it's XML
                    if (value.type.includes("xml") || fileContent.trim().startsWith("<")) {
                        xmlContent = fileContent;
                        logDetails += `XML_FILE_FOUND: ${key} \\n`;
                    }
                    // Check if it's an image
                    else if (value.type.includes("image/")) {
                        imageFile = value;
                        logDetails += `IMAGE_FILE_FOUND: ${key}, size: ${value.size} \\n`;
                    }
                }
            }
        }

        if (!xmlContent) {
            logDetails += "WEBHOOK_FAIL: No XML received\\n";
            console.error(`${logPrefix} ${logDetails} `);
            return NextResponse.json({
                error: "No XML metadata found"
            }, { status: 400 });
        }

        // Parse XML (igual que el PHP con simplexml_load_string)
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_"
        });
        xmlData = parser.parse(xmlContent);

        console.log(`${logPrefix} Parsed XML: `, JSON.stringify(xmlData, null, 2));

        // Extract MAC Address for device identification (como el PHP)
        const macAddress = xmlData.macAddress || xmlData.EventNotificationAlert?.macAddress;
        let device = null;

        if (macAddress) {
            logDetails += `DEVICE_ID_FOUND_IN_XML: MAC Address = ${macAddress} \\n`;
            device = await prisma.device.findFirst({
                where: { mac: macAddress }
            });

            if (device) {
                logDetails += `DEVICE_MATCHED_IN_DB: ${device.name} (ID: ${device.id}) \\n`;
            } else {
                logDetails += `DEVICE_NOT_MATCHED_IN_DB: No device found with MAC '${macAddress}'\\n`;
            }
        } else {
            logDetails += "DEVICE_ID_NOT_FOUND_IN_XML: No macAddress tag found\\n";
        }

        // Detect Event Type and Extract Identifier
        const eventType = xmlData.eventType || xmlData.EventNotificationAlert?.eventType || 'unknown';
        const eventNotification = xmlData.EventNotificationAlert || xmlData;

        let plateNumber = eventNotification.ANPR?.licensePlate || eventNotification.licensePlate;
        let employeeNo = eventNotification.AccessControlEvent?.employeeNoString || eventNotification.employeeNo;
        let personName = eventNotification.AccessControlEvent?.name || eventNotification.name;

        let identifier = "";
        let idType: 'PLATE' | 'FACE' | 'UNKNOWN' = 'UNKNOWN';

        if (plateNumber) {
            identifier = plateNumber.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
            idType = 'PLATE';
        } else if (employeeNo) {
            identifier = employeeNo.toString();
            idType = 'FACE';
        }

        if (!identifier) {
            logDetails += `WEBHOOK_FAIL: No identifier (plate or face) found in XML. EventType: ${eventType}\\n`;
            console.error(`${logPrefix} ${logDetails} `);
            return NextResponse.json({
                error: "Identifier not found"
            }, { status: 400 });
        }

        logDetails += `EVENT_TYPE: ${eventType}, ID: ${identifier} (${idType}) \\n`;

        // Get timestamp from camera or fallback to server
        let eventTimestamp = new Date();
        const cameraDateTime = eventNotification.dateTime;

        if (cameraDateTime) {
            try {
                eventTimestamp = new Date(cameraDateTime);
                logDetails += `TIMESTAMP_FROM_CAMERA: ${cameraDateTime} \\n`;
            } catch (e) {
                logDetails += `TIMESTAMP_PARSE_ERROR: ${cameraDateTime}. Using server time.\\n`;
            }
        }

        // DEBOUNCE (using identifier + type to avoid cross-type collisions)
        const debounceKey = `${idType}:${identifier}`;
        const now = Date.now();
        const lastSeen = debounceCache.get(debounceKey);
        if (lastSeen && now - lastSeen < DEBOUNCE_TIME) {
            logDetails += `DEBOUNCED: ${debounceKey} \\n`;
            console.log(`${logPrefix} ${logDetails} `);
            return NextResponse.json({ message: "Debounced", id: identifier });
        }
        debounceCache.set(debounceKey, now);

        // Save Image (como el PHP)
        let relativeImagePath = "";
        if (imageFile) {
            try {
                const buffer = Buffer.from(await imageFile.arrayBuffer());
                const folder = idType === 'PLATE' ? 'lpr' : 'face';

                const devName = sanitizeName(device?.name);
                const fDate = formatEventDate(eventTimestamp);

                let filename = "";
                if (idType === 'PLATE') {
                    const direction = (device as any)?.direction === 'EXIT' ? 'salida' : 'entrada';
                    filename = `hik-lpr-${devName}-${direction}-${fDate}-${eventId}.jpg`;
                } else {
                    const direction = (device as any)?.direction === 'EXIT' ? 'salida' : 'entrada';
                    filename = `hik-face-${devName}-${direction}-${fDate}-${eventId}.jpg`;
                }

                relativeImagePath = await uploadToS3(buffer, filename, imageFile.type || "image/jpeg", folder);
                logDetails += `IMAGE_SAVED_S3: ${relativeImagePath} \\n`;
            } catch (imgError: any) {
                logDetails += `IMAGE_S3_UPLOAD_ERROR: ${imgError.message} \\n`;
            }
        }

        // Find Credential & User
        let credential = null;
        if (idType === 'PLATE') {
            credential = await prisma.credential.findFirst({
                where: { value: identifier, type: "PLATE" },
                include: { user: true },
            });
        } else {
            // For Face events, the identifier is usually the employeeNo.
            // In OmniAccess, we might map this to a DNI or a special EmployeeNo credential.
            // Let's look for a user where employeeNo match or fallback to DNI
            credential = await prisma.credential.findFirst({
                where: {
                    userId: { not: undefined },
                    value: identifier,
                    type: "FACE" // Face recognition credential type
                },
                include: { user: true }
            });

            if (!credential) {
                // Try finding user directly by personal ID (DNI) if identifier matches
                const user = await prisma.user.findFirst({
                    where: { OR: [{ dni: identifier }, { name: personName }] }
                });
                if (user) {
                    credential = { userId: user.id, user } as any;
                }
            }
        }

        const decision: AccessDecision = credential ? "GRANT" : "DENY";
        logDetails += `ACCESS_DECISION: ${decision}${credential?.user ? ` for user ${credential.user.name}` : ' (no match)'} \n`;

        // Extract Metadata
        let detailsString = "";
        if (idType === 'PLATE') {
            const anprData = eventNotification.ANPR || {};
            const vehicleInfo = anprData.vehicleInfo || {};
            const brandName = vehicleInfo.vehicleLogoRecog ? getVehicleBrandName(vehicleInfo.vehicleLogoRecog) : "Desconocido";
            detailsString = `Marca: ${brandName}, Color: ${vehicleInfo.color || "N/A"}, Tipo: ${anprData.vehicleType || "Vehículo"}`;
        } else {
            const acEvent = eventNotification.AccessControlEvent || {};
            detailsString = `Modo: ${acEvent.currentVerifyMode || "Rostro"}, Persona: ${personName || "N/A"}`;
        }

        logDetails += `METADATA: ${detailsString} \n`;

        // Use found device or first available
        if (!device) {
            device = await prisma.device.findFirst();
            if (!device) {
                logDetails += "ERROR: No devices configured\\n";
                console.error(`${logPrefix} ${logDetails} `);
                return NextResponse.json({
                    error: "No devices configured"
                }, { status: 500 });
            }
        }

        // Create AccessEvent (como el create_event_record de PHP)
        const event = await prisma.accessEvent.create({
            data: {
                id: eventId,
                timestamp: eventTimestamp,
                credentialId: (credential as any)?.id,
                userId: credential?.userId,
                deviceId: device.id,
                snapshotPath: relativeImagePath,
                decision,
                plateDetected: idType === 'PLATE' ? identifier : null,
                details: detailsString,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        cara: true,
                        unit: true
                    }
                },
                device: true,
            },
        });

        logDetails += `EVENT_INSERT_SUCCESS: ${event.id} \\n`;
        console.log(`${logPrefix} ${logDetails} `);

        // Emit Socket.io
        if ((global as any).io) {
            (global as any).io.emit("NEW_ACCESS", event);
            logDetails += "SOCKET_EMITTED\\n";
        }

        // WAHA Notification
        try {
            const notifyNumberSetting = await getSetting("WAHA_NOTIFICATION_NUMBER");
            if (notifyNumberSetting && notifyNumberSetting.value) {
                const notifyNumber = notifyNumberSetting.value;
                const timeStr = eventTimestamp.toLocaleString('es-UY', { timeZone: 'America/Montevideo', hour: '2-digit', minute: '2-digit' });
                const icon = decision === 'GRANT' ? '✅' : '🚫';
                const userName = event.user?.name || "Desconocido";
                const unitName = (event.user as any)?.unit?.name || "-";

                const caption = `🚨 *Nuevo Evento Detectado*\n\n` +
                    `🕒 ${timeStr}\n` +
                    `${idType === 'PLATE' ? '🚘' : '👤'} *${idType === 'PLATE' ? identifier : (personName || identifier)}*\n` +
                    `📍 ${device.name}\n` +
                    `${idType === 'PLATE' ? `👤 ${userName} (${unitName})\n` : ''}` +
                    `📊 Estado: ${icon} ${decision === 'GRANT' ? 'Permitido' : 'Denegado'}`;

                if (imageFile) {
                    const buffer = Buffer.from(await imageFile.arrayBuffer());
                    const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                    await sendWahaImage(notifyNumber, { base64 }, caption);
                    logDetails += `WAHA_IMG_SENT: ${notifyNumber}\\n`;
                } else {
                    await sendWahaText(notifyNumber, caption);
                    logDetails += `WAHA_TEXT_SENT: ${notifyNumber}\\n`;
                }
            }
        } catch (wahaError) {
            console.error("Failed to send WAHA notification", wahaError);
            logDetails += `WAHA_ERROR: ${wahaError}\\n`;
        }

        // Respond with Hikvision XML format (como el PHP)
        const xmlResponse = `<? xml version = "1.0" encoding = "UTF-8" ?> <ResponseStatus version="2.0" xmlns = "http://www.hikvision.com/ver20/XMLSchema" > <requestURL>/ISAPI/Event / notification / alertStream < /requestURL><statusCode>1</statusCode > <statusString>OK < /statusString><subStatusCode>ok</subStatusCode > </ResponseStatus>`;

        return new NextResponse(xmlResponse, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml',
            },
        });

    } catch (error: any) {
        logDetails += `ERROR: ${error.message}\\n`;
        console.error(`${logPrefix} ${logDetails}`);
        console.error(error.stack);

        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
