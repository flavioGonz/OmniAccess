const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const c1 = await prisma.credential.findFirst({ where: { value: 'AD058TT' } });
    const c2 = await prisma.credential.findFirst({ where: { value: 'AB016XY' } });
    const c3 = await prisma.credential.findFirst({ where: { value: 'AF999FG' } });
    console.log('AD058TT:', c1);
    console.log('AB016XY:', c2);
    console.log('AF999FG:', c3);
}

main().catch(console.error).finally(() => prisma.$disconnect());
