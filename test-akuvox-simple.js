
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const prisma = new PrismaClient();

async function run() {
    const device = await prisma.device.findFirst({ where: { brand: 'AKUVOX' } });
    if (!device) { console.log("No device"); return; }

    console.log(`Simple test on: ${device.ip}`);
    const token = Buffer.from(`${device.username}:${device.password}`).toString('base64');

    const testId = "200";

    // Cleanup
    try { await axios.post(`http://${device.ip}/api/user/delete`, { "target": "user", "action": "delete", "data": { "ID": [testId] } }, { headers: { Authorization: `Basic ${token}` }, httpsAgent }); } catch (e) { }

    const payload = {
        "target": "user",
        "action": "add",
        "data": {
            "item": [{
                "ID": testId,
                "Name": "SimpleTest",
                "UserCode": testId,
                "Type": "0", // Explicit Type
                "Group": "Default" // Explicit Group
            }]
        }
    };

    console.log("Sending:", JSON.stringify(payload, null, 2));

    try {
        const r = await axios.post(`http://${device.ip}/api/user/add`, payload, {
            headers: { Authorization: `Basic ${token}` }, httpsAgent
        });
        console.log("Response:", JSON.stringify(r.data));
    } catch (e) {
        console.error("Failed:", e.message);
    }

    // Verify
    try {
        // Wait a bit
        await new Promise(r => setTimeout(r, 1000));

        const r = await axios.post(`http://${device.ip}/api/user/get`, {
            "target": "user", "action": "get", "data": { "offset": 0, "num": 2000 }
        }, { headers: { Authorization: `Basic ${token}` }, httpsAgent });

        const found = r.data.data.item.find(u => u.ID === testId);
        if (found) console.log("✅ SUCCESS! User created.");
        else console.log("❌ FAILED. User 200 not found.");

    } catch (e) {
        console.error("Verify failed:", e.message);
    }
}

run();
