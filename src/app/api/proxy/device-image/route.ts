
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AkuvoxDriver } from "@/lib/drivers/AkuvoxDriver";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const deviceId = searchParams.get("deviceId");
    const userId = searchParams.get("userId");
    const altId = searchParams.get("altId");
    const path = searchParams.get("path");
    const type = searchParams.get("type") || "face"; // face or other

    if (!deviceId || !userId) {
        return new NextResponse("Missing params", { status: 400 });
    }

    try {
        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!device) return new NextResponse("Device not found", { status: 404 });

        if (device.brand === 'AKUVOX') {
            const driver = new AkuvoxDriver();
            // We use a specific method in driver to fetch image buffer
            const imageBuffer = await driver.getFaceImage(device, userId, altId || undefined, path || undefined);

            if (!imageBuffer) {
                return new NextResponse("Image not found", { status: 404 });
            }

            return new NextResponse(imageBuffer as any, {
                headers: {
                    "Content-Type": "image/jpeg",
                    "Cache-Control": "public, max-age=3600"
                }
            });
        }

        return new NextResponse("Brand not supported", { status: 400 });

    } catch (error: any) {
        console.error("Proxy Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
