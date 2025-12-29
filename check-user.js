const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const credential = await prisma.credential.findFirst({
        where: { value: 'AD058TT' },
        include: { user: true }
    });
    console.log('CREDENTIAL WITH USER:', JSON.stringify(credential, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
