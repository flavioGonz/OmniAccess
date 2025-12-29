
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import * as https from "https";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const prisma = new PrismaClient();

async function run() {
    const device = await prisma.device.findFirst({ where: { brand: 'AKUVOX' } });
    if (!device) { console.log("No device"); return; }

    console.log(`Checking logs for device: ${device.name} (${device.ip})`);

    // Try the potential endpoint for logs/records
    const url = `http://${device.ip}/api/record/get`;
    const token = Buffer.from(`${device.username}:${device.password}`).toString('base64');

    try {
        const response = await axios.post(url, {
            "target": "record",
            "action": "get",
            "data": { "offset": 0, "num": 5 }
        }, {
            headers: { Authorization: `Basic ${token}` },
            httpsAgent,
            timeout: 5000
        });

        console.log("SUCCESS! Logs retrieved:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (e: any) {
        console.error("Error fetching logs:", e.message);
        if (e.response) {
            console.log("Status:", e.response.status);
            console.log("Data:", JSON.stringify(e.response.data, null, 2));
        }
    }
}

run();
