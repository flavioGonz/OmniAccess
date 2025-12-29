
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const unit = await prisma.unit.findFirst({
        where: {
            OR: [
                { id: '1030' },
                { name: { contains: '1030' } },
                { number: '1030' }
            ]
        }
    });
    console.log(JSON.stringify(unit));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
