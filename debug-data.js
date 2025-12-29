const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const devices = await prisma.device.findMany();
    console.log("Devices in DB:", JSON.stringify(devices, null, 2));

    const recentEvents = await prisma.accessEvent.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
        include: { device: true }
    });
    console.log("Recent Events:", JSON.stringify(recentEvents, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
