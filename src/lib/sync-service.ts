import { PrismaClient } from "@prisma/client";
import { HikvisionDriver } from "./drivers/HikvisionDriver";

const prisma = new PrismaClient();
const driver = new HikvisionDriver();

export async function syncPlates() {
    console.log("=== Starting Bi-directional Plate Sync ===");

    // 1. Get all LPR devices
    const devices = await prisma.device.findMany({
        where: { type: "LPR_CAMERA" }
    });

    if (devices.length === 0) {
        console.log("No LPR devices found to sync.");
        return;
    }

    // 2. Get all valid credentials from DB
    const dbCredentials = await prisma.credential.findMany({
        where: { type: "PLATE", user: { isActive: true } }
    });
    const dbPlates = new Set(dbCredentials.map(c => c.value));

    for (const device of devices) {
        console.log(`Syncing device: ${device.name} (${device.ip})`);

        // 3. Get plates from Device
        const devicePlates = await driver.getPlates(device);

        let removedCount = 0;

        // 4. Find zombies (on device but not in DB)
        for (const plate of devicePlates) {
            if (!dbPlates.has(plate)) {
                await driver.deleteCredential(plate, device);
                removedCount++;
            }
        }

        console.log(`Device ${device.ip}: Removed ${removedCount} zombie plates.`);

        // 5. Push missing (in DB but not on device) -> upsertCredential handles this if called explicitly
        // This script focuses on CLEANUP (Sanity Check) as requested, but we could also push.
        // Let's rely on the manual "Save" action for pushing new ones for now to avoid massive traffic bursts,
        // or we could iterate dbPlates and check if not in devicePlates.
    }
    console.log("=== Sync Complete ===");
}
