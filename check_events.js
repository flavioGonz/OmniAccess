const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const e = await prisma.accessEvent.findFirst({
        where: { snapshotPath: { contains: '/api/files/face/aku' } },
        orderBy: { timestamp: 'desc' }
    });
    if (e) {
        console.log('FILENAME:' + e.snapshotPath);
    } else {
        console.log('No event found');
    }
}
run().finally(() => prisma.$disconnect());
