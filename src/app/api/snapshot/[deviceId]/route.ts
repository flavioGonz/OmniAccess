import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import https from "https";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * GET /api/snapshot/:deviceId
 *
 * Returns a live snapshot from the camera.
 * Public endpoint (add to middleware).
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    const { deviceId } = await params;

    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { ip: true, username: true, password: true, brand: true },
        });

        if (!device) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        // Build snapshot URL based on brand
        let snapshotUrl: string;
        const headers: Record<string, string> = {};

        if (device.username && device.password) {
            headers["Authorization"] = `Basic ${Buffer.from(`${device.username}:${device.password}`).toString("base64")}`;
        }

        switch (device.brand) {
            case "BOSCH":
                snapshotUrl = `https://${device.ip}/snap.jpg?JpegSize=L`;
                break;
            case "HIKVISION":
                snapshotUrl = `http://${device.ip}/ISAPI/Streaming/channels/1/picture`;
                break;
            case "DAHUA":
                snapshotUrl = `http://${device.ip}/cgi-bin/snapshot.cgi`;
                break;
            default:
                snapshotUrl = `http://${device.ip}/snap.jpg`;
        }

        const imageBuffer = await fetchSnapshot(snapshotUrl, headers);

        if (!imageBuffer) {
            return new NextResponse("No snapshot available", { status: 502 });
        }

        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        });
    } catch (err: any) {
        console.error(`[Snapshot] Error for device ${deviceId}:`, err.message);
        return new NextResponse("Error fetching snapshot", { status: 500 });
    }
}

function fetchSnapshot(url: string, headers: Record<string, string>): Promise<Buffer | null> {
    return new Promise((resolve) => {
        const isHttps = url.startsWith("https");
        const mod = isHttps ? https : require("http");
        const parsed = new URL(url);

        const options: any = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: "GET",
            headers,
            timeout: 5000,
        };

        if (isHttps) {
            options.agent = httpsAgent;
        }

        const req = mod.request(options, (res: any) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve(Buffer.concat(chunks));
                } else {
                    resolve(null);
                }
            });
        });

        req.on("error", () => resolve(null));
        req.on("timeout", () => { req.destroy(); resolve(null); });
        req.end();
    });
}
