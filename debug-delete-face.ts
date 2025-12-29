
import { PrismaClient } from '@prisma/client'
import { AkuvoxDriver } from './src/lib/drivers/AkuvoxDriver'

const prisma = new PrismaClient()

async function debugDelete() {
    try {
        // 1. Get Device
        const device = await prisma.device.findFirst({
            where: {
                ip: { contains: '10.10.10.203' } // Target specific IP from screenshot
            }
        })

        if (!device) {
            console.error('❌ Device 10.10.10.203 not found in DB!');
            const all = await prisma.device.findMany();
            console.log('Available IPs:', all.map(d => d.ip));
            return;
        }

        console.log(`\n📱 Device Found: ${device.name} (${device.ip}) Auth: ${device.authType}`);
        const driver = new AkuvoxDriver();

        // 2. Try to GET user info first to debug "UserCode"
        console.log('\n🔍 Fetching User 45 info...');
        try {
            // Using raw request to inspect
            // @ts-ignore
            const info = await driver.request("POST", "/api/user/get", {
                "target": "user",
                "action": "get",
                "data": { "ID": ["45"] }
            }, device);
            console.log('User 45 Info:', JSON.stringify(info, null, 2));
        } catch (e: any) {
            console.error('Error fetching info:', e.message);
        }

        // 3. Try Delete
        console.log('\n🗑️ Attempting Delete ID=45 UserID=13402...');
        const result = await driver.deleteFace(device, '45', '13402');

        console.log('\n✅ Delete Result:', result);

    } catch (error) {
        console.error('❌ Script Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

debugDelete()
