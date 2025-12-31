import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";
import { uploadToS3 } from "@/lib/s3";
import { AccessDecision } from "@prisma/client";
import { getVehicleBrandName } from "@/lib/hikvision-codes";

// Global cache for debounce: Plate -> Timestamp
const debounceCache = new Map<string, number>();
const DEBOUNCE_TIME = 5000;

// Simple GET endpoint for testing
export async function GET(req: NextRequest) {
    return NextResponse.json({
        status: "ok",
        message: "Hikvision webhook endpoint is active",
        timestamp: new Date().toISOString()
    });
}

export async function POST(req: NextRequest) {
    const logPrefix = `[${new Date().toISOString()}]`;
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

        // Extract plate number (como el PHP: $xml->ANPR->licensePlate)
        const plateNumber = xmlData.ANPR?.licensePlate ||
            xmlData.EventNotificationAlert?.ANPR?.licensePlate ||
            xmlData.licensePlate;

        const eventType = xmlData.eventType || xmlData.EventNotificationAlert?.eventType || 'unknown';

        if (!plateNumber) {
            logDetails += "WEBHOOK_FAIL: No plate number found in XML\\n";
            console.error(`${logPrefix} ${logDetails} `);
            return NextResponse.json({
                error: "Plate number not found"
            }, { status: 400 });
        }

        // Clean plate (como el PHP: strtoupper(preg_replace('/[^A-Z0-9]/i', '', $plate)))
        const cleanPlate = plateNumber.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
        logDetails += `PLATE_EXTRACTED: ${cleanPlate} \\n`;

        // Get timestamp from camera or fallback to server (como el PHP)
        let eventTimestamp = new Date();
        const cameraDateTime = xmlData.dateTime || xmlData.EventNotificationAlert?.dateTime;

        if (cameraDateTime) {
            try {
                eventTimestamp = new Date(cameraDateTime);
                logDetails += `TIMESTAMP_FROM_CAMERA: ${cameraDateTime} (${eventTimestamp.toISOString()}) \\n`;
            } catch (e) {
                logDetails += `TIMESTAMP_PARSE_ERROR: Could not parse '${cameraDateTime}'.Using server time.\\n`;
                eventTimestamp = new Date();
            }
        } else {
            logDetails += "TIMESTAMP_MISSING_XML: Using server time\\n";
        }

        // DEBOUNCE
        const now = Date.now();
        const lastSeen = debounceCache.get(cleanPlate);
        if (lastSeen && now - lastSeen < DEBOUNCE_TIME) {
            logDetails += `DEBOUNCED: ${cleanPlate} \\n`;
            console.log(`${logPrefix} ${logDetails} `);
            return NextResponse.json({ message: "Debounced", plate: cleanPlate });
        }
        debounceCache.set(cleanPlate, now);

        // Save Image (como el PHP)
        let relativeImagePath = "";
        if (imageFile) {
            try {
                const buffer = Buffer.from(await imageFile.arrayBuffer());
                const filename = `hik_${cleanPlate}_${eventTimestamp.getTime()}.jpg`;

                relativeImagePath = await uploadToS3(buffer, filename, imageFile.type || "image/jpeg", "lpr");
                logDetails += `IMAGE_SAVED_S3: ${relativeImagePath} \\n`;
            } catch (imgError: any) {
                logDetails += `IMAGE_S3_UPLOAD_ERROR: ${imgError.message} \\n`;
            }
        }

        // Find Credential & User (como el PHP busca en vehicles)
        const credential = await prisma.credential.findFirst({
            where: { value: cleanPlate, type: "PLATE" },
            include: { user: true },
        });

        const decision: AccessDecision = credential ? "GRANT" : "DENY";
        logDetails += `ACCESS_DECISION: ${decision}${credential ? ` for user ${credential.user?.name}` : ' (no match)'} \n`;

        // Extract Vehicle Metadata from the correct fields
        const anprData = xmlData.ANPR || xmlData.EventNotificationAlert?.ANPR || {};
        const vehicleInfo = anprData.vehicleInfo || {};

        // Color: Ya viene como texto en vehicleInfo.color ("blue", "gray", "white", etc.)
        const colorText = vehicleInfo.color || "Desconocido";

        // Tipo: Ya viene como texto en vehicleType ("SUVMPV", "sedan", etc.)
        const typeText = anprData.vehicleType || "Vehículo";

        // Marca: Viene como código numérico en vehicleInfo.vehicleLogoRecog
        const brandCode = vehicleInfo.vehicleLogoRecog;
        const brandName = brandCode ? getVehicleBrandName(brandCode) : "Desconocido";

        const detailsString = `Marca: ${brandName}, Color: ${colorText}, Tipo: ${typeText} `;
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

        // Create AccessEvent
        const event = await prisma.accessEvent.create({
            data: {
                timestamp: eventTimestamp,
                credentialId: credential?.id,
                userId: credential?.userId,
                deviceId: device.id,
                snapshotPath: relativeImagePath,
                decision,
                plateDetected: cleanPlate,
                details: detailsString,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        cara: true, // Explicitly select the face image path
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
