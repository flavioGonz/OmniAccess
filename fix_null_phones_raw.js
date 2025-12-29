
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Using raw query to fix null phones...')
    const result = await prisma.$executeRaw`UPDATE "User" SET "phone" = '0000000000' WHERE "phone" IS NULL OR "phone" = ''`
    console.log('Update complete. Rows modified:', result)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
