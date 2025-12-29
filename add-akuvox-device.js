const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addAkuvoxDevice() {
    try {
        const device = await prisma.device.create({
            data: {
                name: "Portero Akuvox Principal",
                deviceType: "FACE_TERMINAL",
                brand: "AKUVOX",
                ip: "10.10.10.202",
                mac: "00:11:22:33:44:55",
                direction: "ENTRY",
                username: "api",
                password: "Api*2011"
            }
        });

        console.log('✅ Dispositivo Akuvox agregado:', device);
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addAkuvoxDevice();
