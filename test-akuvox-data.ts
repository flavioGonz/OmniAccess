import { PrismaClient } from '@prisma/client'
import { AkuvoxDriver } from './src/lib/drivers/AkuvoxDriver'

const prisma = new PrismaClient()

async function testAkuvoxData() {
    try {
        const device = await prisma.device.findFirst({
            where: { brand: 'AKUVOX' }
        })

        if (!device) {
            console.log('❌ No Akuvox device found')
            return
        }

        console.log(`\n🔧 Testing device: ${device.name} (${device.ip})\n`)

        const driver = new AkuvoxDriver()

        console.log('📥 Fetching users...')
        const usersResponse = await driver['request']("POST", "/api/user/get",
            { "target": "user", "action": "get", "data": { "offset": 0, "num": 5 } },
            device
        )

        console.log('\n👥 Users Response:')
        console.log(JSON.stringify(usersResponse, null, 2))

        console.log('\n📥 Fetching RF keys...')
        const rfkeysResponse = await driver['request']("POST", "/api/rfkey/get",
            { "target": "rfkey", "action": "get", "data": { "offset": 0, "num": 5 } },
            device
        )

        console.log('\n🏷️  RF Keys Response:')
        console.log(JSON.stringify(rfkeysResponse, null, 2))

    } catch (error: any) {
        console.error('❌ Error:', error.message)
    } finally {
        await prisma.$disconnect()
    }
}

testAkuvoxData()
