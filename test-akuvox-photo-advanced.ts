import { PrismaClient } from '@prisma/client'
import axios from "axios";
import https from "https";

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

const prisma = new PrismaClient()

async function testAkuvoxAdvanced() {
    try {
        const device = await prisma.device.findFirst({
            where: { brand: 'AKUVOX' }
        })

        if (!device) {
            console.log('❌ No Akuvox device found')
            return
        }

        const userId = "14";
        console.log(`\n🔧 Advanced photo testing for User ${userId} on ${device.ip}\n`)

        const auth = Buffer.from(`${device.username}:${device.password}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        };

        const tests = [
            {
                method: 'POST',
                url: `http://${device.ip}/api/face/get`,
                data: {
                    "target": "face",
                    "action": "get",
                    "data": { "ID": userId }
                }
            },
            {
                method: 'POST',
                url: `http://${device.ip}/api/face/download`,
                data: {
                    "target": "face",
                    "action": "download",
                    "data": { "ID": userId }
                }
            },
            {
                method: 'POST',
                url: `http://${device.ip}/api/user/get`,
                data: {
                    "target": "user",
                    "action": "get",
                    "data": { "ID": userId, "with_face": 1 } // Trying undocumented flags
                }
            },
            { // Intento de obtener via GET directa
                method: 'GET',
                url: `http://${device.ip}/fcgi/do?action=GetFace&UserID=${userId}`,
                data: null
            }
        ];

        for (const test of tests) {
            console.log(`Trying ${test.method} ${test.url}`);
            console.log(`   Data: ${JSON.stringify(test.data)}`);

            try {
                const response = await axios({
                    method: test.method,
                    url: test.url,
                    data: test.data,
                    headers,
                    httpsAgent,
                    timeout: 5000
                });

                console.log(`✅ Status: ${response.status}`);
                console.log(`   Keys: ${Object.keys(response.data)}`);

                const data = response.data;
                if (data.data && data.data.Image) {
                    console.log('🎉 FOUND IMAGE IN DATA! Length:', data.data.Image.length);
                }
                if (data.Image) {
                    console.log('🎉 FOUND IMAGE AT ROOT! Length:', data.Image.length);
                }
                if (response.headers['content-type'].includes('image')) {
                    console.log('🎉 RESPONSE IS AN IMAGE!');
                }

                // Log response sample
                const str = JSON.stringify(data).substring(0, 200);
                console.log(`   Response: ${str}...`);

            } catch (err: any) {
                console.log(`❌ Error: ${err.message}`);
                if (err.response) {
                    console.log(`   Status: ${err.response.status}`);
                }
            }
            console.log('-------------------');
        }

    } catch (error: any) {
        console.error('❌ General Error:', error.message)
    } finally {
        await prisma.$disconnect()
    }
}

testAkuvoxAdvanced()
