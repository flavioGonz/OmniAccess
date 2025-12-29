
const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const prisma = new PrismaClient();

async function run() {
    const device = await prisma.device.findFirst({ where: { brand: 'AKUVOX' } });
    if (!device) { console.log("No device"); return; }

    console.log(`Device: ${device.ip}`);
    const token = Buffer.from(`${device.username}:${device.password}`).toString('base64');

    // 1. Try User Get (Control)
    try {
        console.log("Testing USER get (Control)...");
        const r1 = await axios.post(`http://${device.ip}/api/user/get`, { "target": "user", "action": "get", "data": { "offset": 0, "num": 1 } }, { headers: { Authorization: `Basic ${token}` }, httpsAgent, timeout: 5000 });
        console.log("USER OK");
    } catch (e) { console.log("USER FAIL:", e.message); }

    // 2. Try Record Get
    try {
        console.log("Testing RECORD get...");
        const r2 = await axios.post(`http://${device.ip}/api/record/get`, { "target": "record", "action": "get", "data": { "offset": 0, "num": 1 } }, { headers: { Authorization: `Basic ${token}` }, httpsAgent, timeout: 5000 });
        console.log("RECORD OK:", JSON.stringify(r2.data));
    } catch (e) { console.log("RECORD FAIL:", e.message); }

    // 3. Try Log Get
    try {
        console.log("Testing LOG get...");
        const r3 = await axios.post(`http://${device.ip}/api/log/get`, { "target": "log", "action": "get", "data": { "offset": 0, "num": 1 } }, { headers: { Authorization: `Basic ${token}` }, httpsAgent, timeout: 5000 });
        console.log("LOG OK:", JSON.stringify(r3.data));
    } catch (e) { console.log("LOG FAIL:", e.message); }
}

run();
