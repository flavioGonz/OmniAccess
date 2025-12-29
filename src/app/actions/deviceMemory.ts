"use server";

import { prisma } from "@/lib/prisma";
import { AkuvoxDriver } from "@/lib/drivers/AkuvoxDriver";

import { HikvisionDriver } from "@/lib/drivers/HikvisionDriver";
import { uploadToS3 } from "@/lib/s3";

export async function getDeviceFaces(deviceId: string) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error("Device not found");

    if (device.brand === 'AKUVOX') {
        const driver = new AkuvoxDriver();
        return await driver.getFaceList(device);
    }

    if (device.brand === 'HIKVISION') {
        const driver = new HikvisionDriver();
        const plates = await driver.getPlates(device);
        return plates.map((plateNumber: string, index: number) => ({
            ID: plateNumber, // Using plate number as ID
            UserID: `HIK-${index}`,
            Name: `Placa ${plateNumber}`,
            CardCode: plateNumber, // Show plate in card field for table
            HasFace: false,
            HasTag: true,
            IsPlate: true
        }));
    }

    return [];
}

export async function getDatabaseStats() {
    const totalUsers = await prisma.user.count();
    const totalTags = await prisma.credential.count({ where: { type: 'TAG' } });
    const totalPlates = await prisma.credential.count({ where: { type: 'PLATE' } });
    return { users: totalUsers, tags: totalTags, plates: totalPlates };
}

export async function deleteDeviceFace(deviceId: string, faceId: string, userId?: string, userCode?: string) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error("Device not found");

    if (device.brand === 'AKUVOX') {
        const driver = new AkuvoxDriver();
        return await driver.deleteFace(device, faceId, userId, userCode);
    }

    if (device.brand === 'HIKVISION') {
        const driver = new HikvisionDriver();
        await driver.deleteCredential(faceId, device);
        return true;
    }

    return false;
}

export async function syncUserToDevice(deviceId: string, userId: string) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { credentials: true }
    });

    if (!device || !user) throw new Error("Device or User not found");

    if (device.brand === 'AKUVOX') {
        const driver = new AkuvoxDriver();
        // Check if user has a face photo (cara) OR a Face credential
        const hasFace = user.cara && user.cara.length > 0;

        // Sync user regardless of face (handles PIN/Tag too)
        await driver.syncUserWithFace(user, device);
        return true;
    }

    if (device.brand === 'HIKVISION') {
        const driver = new HikvisionDriver();
        const plate = user.credentials.find(c => c.type === 'PLATE');
        if (plate) {
            await driver.upsertCredential(plate, device);
            return true;
        }
    }
    return false;
}

export async function syncIdentityAction(deviceId: string, item: any, unitId?: string) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error("Device not found");

    const importDate = new Date().toLocaleString();
    const comment = `Importado de [${device.name}] el ${importDate}`;

    // Find existing user or create one
    let user = await prisma.user.findFirst({
        where: { name: item.Name }
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                name: item.Name,
                phone: "N/A",
                dni: item.UserID || "",
                unitId: unitId || null,
                // Cara (si hay URL)
                cara: item.FaceUrl || null
            }
        });
        console.log(`[Import] Created user: ${item.Name}`);
    }

    if (item.HasTag) {
        const hasTag = await prisma.credential.findFirst({
            where: { userId: user.id, type: 'TAG', value: item.CardCode }
        });

        if (!hasTag) {
            await prisma.credential.create({
                data: {
                    userId: user.id,
                    type: item.IsPlate ? 'PLATE' : 'TAG',
                    value: item.CardCode,
                    notes: comment
                }
            });
        }
    }

    // Handle Face Image Download
    if (item.HasFace && device.brand === 'AKUVOX') {
        try {
            const driver = new AkuvoxDriver();
            const imageBuffer = await driver.getFaceImage(device, item.ID);

            if (imageBuffer) {
                const fileName = `import_${item.ID}_${Date.now()}.jpg`;
                const fileUrl = await uploadToS3(imageBuffer, fileName, "image/jpeg", "face");

                // Update user with S3 link (proxied)
                await prisma.user.update({
                    where: { id: user.id },
                    data: { cara: fileUrl }
                });
                console.log(`[Import] Saved face image for ${item.Name} to S3: ${fileName}`);
            }
        } catch (e) {
            console.error(`[Import] Failed to save face image for ${item.Name}:`, e);
        }
    }

    return {
        success: true,
        userId: user.id,
        name: user.name,
        hasTag: item.HasTag,
        hasFace: item.HasFace
    };
}

export async function exportAllToDevice(deviceId: string) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error("Device not found");

    // Get all users with credentials or face
    const users = await prisma.user.findMany({
        include: { credentials: true }
    });

    let processed = 0;
    let faces = 0;
    let tags = 0;

    if (device.brand === 'AKUVOX') {
        const driver = new AkuvoxDriver();
        for (const user of users) {
            // Sincronizar usuario completo (Nombre + TAGs + PIN + Cara)
            const hasFace = user.cara && user.cara.length > 0;
            const hasTags = user.credentials.some(c => c.type === 'TAG');

            if (hasFace || hasTags) {
                await driver.syncUserWithFace(user, device);
                if (hasFace) faces++;
                if (hasTags) tags += user.credentials.filter(c => c.type === 'TAG').length;
                processed++;
            }
        }
    }

    if (device.brand === 'HIKVISION') {
        const driver = new HikvisionDriver();
        for (const user of users) {
            const plates = user.credentials.filter(c => c.type === 'PLATE');
            for (const plate of plates) {
                await driver.upsertCredential(plate, device);
                tags++; // Using tags counter for plates here
            }
            processed++;
        }
    }

    return { processed, faces, tags };
}

export async function importAllFromDevice(deviceId: string) {
    // Only kept for legacy reference or bulk call if needed without UI progress
    const items = await getDeviceFaces(deviceId);
    const results = [];
    for (const item of items) {
        results.push(await syncIdentityAction(deviceId, item));
    }
    return results;
}


