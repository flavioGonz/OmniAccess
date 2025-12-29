import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkData() {
    try {
        const users = await prisma.user.count()
        const devices = await prisma.device.count()
        const units = await prisma.unit.count()
        const credentials = await prisma.credential.count()

        console.log('📊 Database Status:')
        console.log(`Users: ${users}`)
        console.log(`Devices: ${devices}`)
        console.log(`Units: ${units}`)
        console.log(`Credentials: ${credentials}`)

        if (users === 0 && devices === 0) {
            console.log('\n⚠️  WARNING: Database appears to be empty!')
            console.log('This likely happened during the migration.')
        } else {
            console.log('\n✅ Data is present in the database')
        }
    } catch (error) {
        console.error('❌ Error checking database:', error)
    } finally {
        await prisma.$disconnect()
    }
}

checkData()
