
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { phone: null },
                { phone: "" }
            ]
        }
    })
    console.log('Users with null or empty phone:', users.map(u => ({ id: u.id, name: u.name, phone: u.phone })))

    if (users.length > 0) {
        console.log('Updating users to have a default phone "0000000000"...')
        await prisma.user.updateMany({
            where: {
                OR: [
                    { phone: null },
                    { phone: "" }
                ]
            },
            data: {
                phone: "0000000000"
            }
        })
        console.log('Update complete.')
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
