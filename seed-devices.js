const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Ensure Exit Device
    const exitDevice = await prisma.device.findFirst({ where: { direction: 'EXIT' } });
    if (!exitDevice) {
        console.log("Creating Exit Camera...");
        await prisma.device.create({
            data: {
                name: "Cámara Salida Secundaria",
                ip: "192.168.1.65",
                mac: "A2:B3:C4:D5:E6:F7",
                direction: "EXIT",
                deviceType: "LPR_CAMERA",
                brand: "HIKVISION"
            }
        });
    }

    // 2. Ensure Face Terminal
    const faceDevice = await prisma.device.findFirst({ where: { deviceType: 'FACE_TERMINAL' } });
    if (!faceDevice) {
        console.log("Creating Face Terminal...");
        await prisma.device.create({
            data: {
                name: "Terminal Facial Hall",
                ip: "192.168.1.100",
                mac: "F1:F2:F3:F4:F5:F6",
                direction: "ENTRY",
                deviceType: "FACE_TERMINAL",
                brand: "AKUVOX"
            }
        });
    }

    console.log("Infrastructure seeded.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
