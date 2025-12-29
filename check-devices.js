const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.device.count();
    console.log(`Total devices: ${count}`);
    if (count === 0) {
        console.log("No devices found. Creating default device...");
        await prisma.device.create({
            data: {
                name: "Cámara Acceso Principal",
                ip: "192.168.1.64",
                mac: "A1:B2:C3:D4:E5:F6",
                direction: "ENTRY",
                deviceType: "LPR_CAMERA",
                brand: "HIKVISION"
            }
        });
        console.log("Default device created.");
    } else {
        const devices = await prisma.device.findMany();
        console.log("Devices:", devices);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
