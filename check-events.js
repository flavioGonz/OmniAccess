const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const events = await prisma.accessEvent.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
        include: { device: true }
    });
    console.log("Recent Events:", JSON.stringify(events, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
