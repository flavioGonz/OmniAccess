import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAkuvoxDevice() {
    try {
        const akuvoxDevices = await prisma.device.findMany({
            where: { brand: 'AKUVOX' }
        })

        console.log('📱 Akuvox Devices Found:', akuvoxDevices.length)

        akuvoxDevices.forEach((device, index) => {
            console.log(`\n🔧 Device ${index + 1}:`)
            console.log(`   Name: ${device.name}`)
            console.log(`   IP: ${device.ip}`)
            console.log(`   MAC: ${device.mac}`)
            console.log(`   Username: ${device.username}`)
            console.log(`   Password: ${device.password ? '***' + device.password.slice(-4) : 'NOT SET'}`)
            console.log(`   Auth Type: ${device.authType}`)
            console.log(`   Active: ${device.isActive}`)
        })

        if (akuvoxDevices.length === 0) {
            console.log('\n⚠️  No Akuvox devices found in database!')
            console.log('Run the seed script to create test devices.')
        }
    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

checkAkuvoxDevice()
