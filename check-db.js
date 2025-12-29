const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const credentials = await prisma.credential.findMany({
        where: { type: 'PLATE' },
        take: 10
    });
    console.log('CREDENTIALS:', JSON.stringify(credentials, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
