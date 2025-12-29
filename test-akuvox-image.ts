import { PrismaClient } from '@prisma/client'
import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

const prisma = new PrismaClient()

async function testAkuvoxImage() {
    try {
        const device = await prisma.device.findFirst({
            where: { brand: 'AKUVOX' }
        })

        if (!device) {
            console.log('❌ No Akuvox device found')
            return
        }

        // Usuario ID 14
        const userId = "14";

        console.log(`\n🔧 Testing deep inspection for User ${userId} on device: ${device.name} (${device.ip})\n`)

        const auth = Buffer.from(`${device.username}:${device.password}`).toString('base64');
        const headers = { 'Authorization': `Basic ${auth}` };

        console.log('\n🔎 Inspecting successful endpoint: /api/user/get?data={"ID":"14"}');
        // Usamos POST porque es lo que usa el driver normalmente, aunque GET funcionó en la prueba anterior
        // Probaremos ambos si es necesario, pero GET funcionó.
        const url = `http://${device.ip}/api/user/get?data={"ID":"${userId}"}`;

        try {
            const response = await axios.get(url, {
                headers,
                httpsAgent,
                timeout: 5000
            });

            console.log(`✅ Response Status: ${response.status}`);
            const data = response.data;

            if (data.data && data.data.item) {
                const items = Array.isArray(data.data.item) ? data.data.item : [data.data.item];
                const user = items[0];

                console.log('User Data Keys:', Object.keys(user));

                if (user.Image) console.log('✅ Found "Image" field! Length:', user.Image.length);
                if (user.FaceImage) console.log('✅ Found "FaceImage" field! Length:', user.FaceImage.length);
                if (user.Photo) console.log('✅ Found "Photo" field! Length:', user.Photo.length);

                // Volcar el objeto completo (truncando campos largos)
                const safeUser = { ...user };
                if (safeUser.Image) safeUser.Image = `[Base64 ${safeUser.Image.length} chars]`;
                console.log('User Object:', JSON.stringify(safeUser, null, 2));
            } else {
                console.log('Unexpected structure:', JSON.stringify(data, null, 2));
            }

        } catch (err: any) {
            console.error('Error in granular inspection:', err.message);
        }

    } catch (error: any) {
        console.error('❌ General Error:', error.message)
    } finally {
        await prisma.$disconnect()
    }
}

testAkuvoxImage()
