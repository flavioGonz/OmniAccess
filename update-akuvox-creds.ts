import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateAkuvoxCredentials() {
    try {
        console.log('🔧 Actualizando credenciales de dispositivos Akuvox...\n')

        const result = await prisma.device.updateMany({
            where: { brand: 'AKUVOX' },
            data: {
                username: 'api',
                password: 'Api*2011',
                authType: 'BASIC'
            }
        })

        console.log(`✅ Actualizados ${result.count} dispositivos Akuvox`)
        console.log('\n📝 Nuevas credenciales:')
        console.log('   Usuario: api')
        console.log('   Password: Api*2011')
        console.log('   Auth Type: BASIC')

        const devices = await prisma.device.findMany({
            where: { brand: 'AKUVOX' }
        })

        console.log('\n📱 Dispositivos actualizados:')
        devices.forEach((device, index) => {
            console.log(`   ${index + 1}. ${device.name} (${device.ip})`)
        })

    } catch (error) {
        console.error('❌ Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

updateAkuvoxCredentials()
