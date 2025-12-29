const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching first device...");
    const device = await prisma.device.findFirst();
    if (!device) {
        throw new Error("No device found!");
    }
    console.log("Device found:", device.id);

    console.log("Creating AccessEvent...");
    try {
        const event = await prisma.accessEvent.create({
            data: {
                timestamp: new Date(),
                deviceId: device.id,
                decision: "DENY",
                plateDetected: "TEST999",
                imagePath: "" // Testing empty string
            }
        });
        console.log("Event created successfully:", event.id);
    } catch (error) {
        console.error("Error creating event:", error);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
