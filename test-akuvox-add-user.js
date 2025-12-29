
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const prisma = new PrismaClient();

async function run() {
    const device = await prisma.device.findFirst({ where: { brand: 'AKUVOX' } });
    if (!device) { console.log("No device"); return; }

    console.log(`Testing add user on: ${device.ip}`);
    const token = Buffer.from(`${device.username}:${device.password}`).toString('base64');

    const testId = "99999";
    const testName = "TestUser API";
    const testCard = "1234567890";
    const testPin = "123456";

    // 1. Delete if exists
    try {
        await axios.post(`http://${device.ip}/api/user/delete`, {
            "target": "user", "action": "delete", "data": { "ID": [testId] }
        }, { headers: { Authorization: `Basic ${token}` }, httpsAgent });
        console.log("Cleaned up old user");
    } catch (e) { }

    // 2. Add User
    console.log("Adding user with payload:");
    const payload = {
        "target": "user",
        "action": "add",
        "data": {
            "item": [{
                "ID": testId,
                "Name": testName,
                "UserCode": testId,
                "CardCode": testCard,
                "PrivatePIN": testPin
            }]
        }
    };
    console.log(JSON.stringify(payload, null, 2));

    try {
        const r = await axios.post(`http://${device.ip}/api/user/add`, payload, {
            headers: { Authorization: `Basic ${token}` }, httpsAgent
        });
        console.log("Add response:", JSON.stringify(r.data));
    } catch (e) {
        console.error("Add failed:", e.message);
        if (e.response) console.log(e.response.data);
    }

    // 3. Get User back
    console.log("Verifying...");
    try {
        const r = await axios.post(`http://${device.ip}/api/user/get`, {
            "target": "user", "action": "get", "data": { "offset": 0, "num": 2000 }
        }, { headers: { Authorization: `Basic ${token}` }, httpsAgent });

        const users = r.data.data.item || [];
        const found = users.find(u => u.ID === testId || u.UserID === testId);

        if (found) {
            console.log("FOUND USER:", JSON.stringify(found, null, 2));
            if (found.CardCode && found.CardCode.includes(testCard)) console.log("✅ Card OK"); else console.log("❌ Card Missing (Got: " + found.CardCode + ")");
            if (found.PrivatePIN === testPin || found.PIN === testPin) console.log("✅ PIN OK"); else console.log("❌ PIN Missing (Got: " + (found.PrivatePIN || found.PIN) + ")");
        } else {
            console.log("❌ USER NOT FOUND IN LIST. Total users: " + users.length);
        }

    } catch (e) {
        console.error("Get failed:", e.message);
    }
}

run();
