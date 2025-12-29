
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const prisma = new PrismaClient();

async function run() {
    const device = await prisma.device.findFirst({ where: { brand: 'AKUVOX' } });
    if (!device) { console.log("No device"); return; }

    console.log(`Cloning user on: ${device.ip}`);
    const token = Buffer.from(`${device.username}:${device.password}`).toString('base64');

    const testId = "99988"; // Different ID
    const testName = "Clone Test API";

    try {
        // 1. Get Template
        const r = await axios.post(`http://${device.ip}/api/user/get`, {
            "target": "user", "action": "get", "data": { "offset": 0, "num": 1 }
        }, { headers: { Authorization: `Basic ${token}` }, httpsAgent });

        const template = r.data.data.item[0];
        console.log("Template:", JSON.stringify(template, null, 2));

        if (!template) {
            console.log("No users to clone from!");
            return;
        }

        // 2. Prepare Payload
        const newUser = { ...template };
        // Overwrite ID
        newUser.ID = testId;
        newUser.UserID = testId;
        newUser.Name = testName;
        newUser.CardCode = "88888888";
        newUser.PrivatePIN = "888888";

        // Ensure sensitive/unneeded fields are clean
        // (Depends on what comes back, assuming safe to send back what we get)

        console.log("Sending Payload Item:", JSON.stringify(newUser, null, 2));

        const rAdd = await axios.post(`http://${device.ip}/api/user/add`, {
            "target": "user",
            "action": "add",
            "data": { "item": [newUser] }
        }, { headers: { Authorization: `Basic ${token}` }, httpsAgent });

        console.log("Add Response:", JSON.stringify(rAdd.data));

        // 3. Verify
        const rGet = await axios.post(`http://${device.ip}/api/user/get`, {
            "target": "user", "action": "get", "data": { "offset": 0, "num": 2000 }
        }, { headers: { Authorization: `Basic ${token}` }, httpsAgent });

        const found = rGet.data.data.item.find(u => u.ID === testId || u.UserID === testId);
        if (found) console.log("SUCCESS! Created cloned user.");
        else console.log("FAILED. User not found.");

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.log(e.response.data);
    }
}

run();
