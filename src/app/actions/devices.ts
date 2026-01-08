"use server";

import { prisma } from "@/lib/prisma";
import { Device, DeviceBrand, DeviceDirection, DeviceType, AuthType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { HikvisionDriver } from "@/lib/drivers/HikvisionDriver";
import { uploadToS3 } from "@/lib/s3";

async function saveFile(file: File | null, folder: string): Promise<string | null> {
    if (!file || !(file instanceof File) || file.size === 0) return null;
    try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filename = `${folder}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

        const fileUrl = await uploadToS3(buffer, filename, file.type || "image/jpeg", "lpr");
        return fileUrl;
    } catch (error) {
        console.error(`Error uploading file to S3 (${folder}):`, error);
        return null;
    }
}

export async function createDevice(formData: FormData) {
    const name = formData.get("name") as string;
    const ip = formData.get("ip") as string;
    const brand = formData.get("brand") as DeviceBrand;
    const deviceType = formData.get("deviceType") as DeviceType;
    const direction = formData.get("direction") as DeviceDirection;
    const location = formData.get("location") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const authType = formData.get("authType") as AuthType;
    const mac = formData.get("mac") as string;
    const groupId = formData.get("groupId") as string;

    // Custom images
    const modelPhotoFile = formData.get("modelPhoto") as File;
    const brandLogoFile = formData.get("brandLogo") as File;

    const modelPhoto = await saveFile(modelPhotoFile, "devices");
    const brandLogo = await saveFile(brandLogoFile, "brands");

    const newDevice = await prisma.device.create({
        data: {
            name,
            ip,
            brand,
            deviceType,
            direction,
            location,
            username,
            password,
            authType,
            mac,
            modelPhoto,
            brandLogo,
            deviceModel: formData.get("deviceModel") as string,
            accessGroups: groupId && groupId !== "none" ? {
                connect: { id: groupId }
            } : undefined
        },
    });

    // Automatic sync on add
    try {
        const { syncHardwareLogs } = await import("@/app/actions/deviceMemory");
        await syncHardwareLogs(newDevice.id);
    } catch (err) {
        console.error("Auto-sync failed on device creation:", err);
    }

    revalidatePath("/admin/devices");
}

export async function updateDevice(id: string, formData: FormData) {
    const name = formData.get("name") as string;
    const ip = formData.get("ip") as string;
    const brand = formData.get("brand") as DeviceBrand;
    const deviceType = formData.get("deviceType") as DeviceType;
    const direction = formData.get("direction") as DeviceDirection;
    const location = formData.get("location") as string;
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const authType = formData.get("authType") as AuthType;
    const mac = formData.get("mac") as string;

    // Custom images
    const modelPhotoFile = formData.get("modelPhoto") as File;
    const brandLogoFile = formData.get("brandLogo") as File;

    const modelPhoto = await saveFile(modelPhotoFile, "devices");
    const brandLogo = await saveFile(brandLogoFile, "brands");

    const deviceModel = formData.get("deviceModel") as string;

    await prisma.device.update({
        where: { id },
        data: {
            name,
            ip,
            brand,
            deviceType,
            direction,
            location,
            username,
            password,
            authType,
            mac,
            deviceModel,
            ...(modelPhoto && { modelPhoto }),
            ...(brandLogo && { brandLogo }),
        },
    });

    revalidatePath("/admin/devices");
}

export async function deleteDevice(id: string) {
    await prisma.device.delete({ where: { id } });
    revalidatePath("/admin/devices");
}

export async function getDevices() {
    return await prisma.device.findMany({
        orderBy: { createdAt: 'desc' }
    });
}

export async function getDevicesCount() {
    return await prisma.device.count();
}

export async function testDeviceConnection(id: string) {
    try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (!device) {
            return { success: false, message: "Device not found" };
        }

        if (device.brand === "HIKVISION") {
            try {
                const driver = new HikvisionDriver();
                // We'll use getPlates as a proxy for connection test
                const plates = await driver.getPlates(device);
                await prisma.device.update({
                    where: { id },
                    data: { lastOnlinePull: new Date() }
                });
                return {
                    success: true,
                    message: "Conectado a Hikvision",
                    details: `Placas en memoria: ${plates.length}`
                };
            } catch (error: any) {
                return {
                    success: false,
                    message: error.message || "Connection failed"
                };
            }
        }

        if (device.brand === "AKUVOX") {
            try {
                const { AkuvoxDriver } = await import("@/lib/drivers/AkuvoxDriver");
                const driver = new AkuvoxDriver();
                // We use any as any to access the private request for testing, 
                // or just use getDeviceStats. Let's use getDeviceStats as a proxy for connection.
                const stats = await driver.getDeviceStats(device);
                await prisma.device.update({
                    where: { id },
                    data: { lastOnlinePull: new Date() }
                });

                return {
                    success: true,
                    message: "Conectado a Akuvox",
                    details: `Identidades detectadas: ${stats.faces + stats.tags}`
                };
            } catch (error: any) {
                return {
                    success: false,
                    message: `Akuvox Error: ${error.message}`,
                };
            }
        }
        return { success: false, message: "Prueba de conexión no implementada para esta marca" };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || "Error al intentar conectar",
            details: error.response?.data ? JSON.stringify(error.response.data) : "Timeout o IP no alcanzable"
        };
    }
}

export async function triggerDeviceRelay(id: string) {
    try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (!device) return { success: false, message: "Dispositivo no encontrado" };

        if (device.brand === "AKUVOX") {
            const { AkuvoxDriver } = await import("@/lib/drivers/AkuvoxDriver");
            const driver = new AkuvoxDriver();
            await driver.triggerRelay(device);
            return { success: true, message: "Relé activado" };
        }

        if (device.brand === "HIKVISION") {
            const driver = new HikvisionDriver();
            await driver.triggerRelay(device);
            return { success: true, message: "Comando de apertura enviado a Hikvision" };
        }

        return { success: false, message: "Marca no compatible con disparo remoto" };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
export async function getDeviceStats(id: string) {
    try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (!device) return { faces: 0, tags: 0, plates: 0 };

        if (device.brand === "AKUVOX") {
            const { AkuvoxDriver } = await import("@/lib/drivers/AkuvoxDriver");
            const driver = new AkuvoxDriver();
            const stats = await driver.getDeviceStats(device);
            // Non-blocking update
            prisma.device.update({ where: { id }, data: { lastOnlinePull: new Date() } }).catch(() => { });
            return { ...stats, plates: 0 };
        }

        if (device.brand === "HIKVISION") {
            const driver = new HikvisionDriver();
            const plates = await driver.getPlates(device);
            // Non-blocking update
            prisma.device.update({ where: { id }, data: { lastOnlinePull: new Date() } }).catch(() => { });
            return { faces: 0, tags: 0, plates: plates.length };
        }

        return { faces: 0, tags: 0, plates: 0 };
    } catch (error) {
        return { faces: 0, tags: 0, plates: 0 };
    }
}

export async function syncPlatesToDevice(deviceId: string) {
    try {
        const device = await prisma.device.findUnique({ where: { id: deviceId } });
        if (!device || device.brand !== "HIKVISION") {
            return { success: false, message: "Dispositivo no compatible para sincronización LPR" };
        }

        const plates = await prisma.credential.findMany({
            where: { type: "PLATE" }
        });

        const driver = new HikvisionDriver();

        // 1. Wipe the camera first for a TRUE mirror (Forzar Sincro)
        console.log(`[Sync] Initiating full wipe for ${device.ip} before mirror...`);
        try {
            await driver.clearWhiteList(device);
            console.log(`[Sync] Camera wiped successfully.`);
        } catch (wipeError) {
            console.warn(`[Sync] Could not wipe camera, will attempt to append:`, wipeError);
        }

        let successCount = 0;
        let failCount = 0;

        for (const plate of plates) {
            try {
                await driver.upsertCredential(plate, device);
                successCount++;
            } catch (err) {
                failCount++;
            }
        }

        revalidatePath("/admin/devices");
        return {
            success: true,
            message: `Sincronización completada: ${successCount} exitosas, ${failCount} fallidas.`
        };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getDevicePlates(id: string) {
    try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (!device || device.brand !== "HIKVISION") {
            return { success: false, message: "Dispositivo no compatible", data: [] };
        }

        const driver = new HikvisionDriver();
        const plates = await driver.getPlatesFromCamera(device);

        return { success: true, data: plates };
    } catch (error: any) {
        return { success: false, message: error.message, data: [] };
    }
}

export async function getDevicePlatesPage(id: string, searchId: string, start: number) {
    try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (!device || device.brand !== "HIKVISION") {
            return { success: false, message: "Dispositivo no compatible" };
        }

        const driver = new HikvisionDriver();
        const result = await driver.getPlatesPage(device, searchId, start);

        return { success: true, ...result };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function addDevicePlate(id: string, plate: string) {
    try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (!device || device.brand !== "HIKVISION") {
            return { success: false, message: "Dispositivo no compatible" };
        }

        const driver = new HikvisionDriver();
        await driver.addPlateToCamera(device, plate);

        return { success: true, message: `Matrícula ${plate} añadida correctamente a la cámara.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function importPlateBatch(id: string, plates: string[]) {
    try {
        const device = await prisma.device.findUnique({ where: { id } });
        if (!device) return { success: false, message: "Dispositivo no encontrado" };

        let importedUser = await prisma.user.findFirst({ where: { name: "MATRICULAS IMPORTADAS" } });
        if (!importedUser) {
            importedUser = await prisma.user.create({
                data: { name: "MATRICULAS IMPORTADAS", phone: "N/A", dni: "IMPORT" }
            });
        }

        let importedCount = 0;
        for (const rawPlate of plates) {
            // Normalización extrema para evitar duplicados por formato
            const plateNum = rawPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (!plateNum || plateNum.length < 3) continue;

            const existingCred = await prisma.credential.findFirst({
                where: { type: 'PLATE', value: plateNum }
            });

            if (!existingCred) {
                await prisma.credential.create({
                    data: {
                        type: 'PLATE',
                        value: plateNum,
                        userId: importedUser.id,
                        notes: `Importado de ${device.name}`
                    }
                });
                importedCount++;
            }

            const existingVehicle = await prisma.vehicle.findUnique({
                where: { plate: plateNum }
            });

            if (!existingVehicle) {
                await prisma.vehicle.create({
                    data: {
                        plate: plateNum,
                        userId: importedUser.id,
                        brand: "LPR",
                        model: "IMPORTADO",
                        notes: `Sincro Hardware ${device.name}`
                    }
                });
            }
        }

        // Revalidar todas las rutas relacionadas para asegurar que el contador suba
        revalidatePath("/admin/vehicles");
        revalidatePath("/admin/credentials");
        revalidatePath("/admin/devices");
        revalidatePath("/admin/dashboard");

        return { success: true, count: importedCount };
    } catch (error: any) {
        console.error("[ImportBatch] Error:", error);
        return { success: false, message: error.message };
    }
}

export async function getPlatesEnrichment() {
    try {
        // Query the latest 1000 events with plate info
        const events = await prisma.accessEvent.findMany({
            where: {
                plateNumber: { not: null },
                details: { contains: "Marca:" }
            },
            orderBy: { timestamp: "desc" },
            take: 2000
        });

        const enrichment: Record<string, { brand: string, color: string, model: string }> = {};

        events.forEach(event => {
            if (!event.plateNumber) return;
            const plate = event.plateNumber.toUpperCase();
            if (enrichment[plate]) return; // Already have latest

            const details = event.details || "";
            // Extract: Marca: Mitsubishi, Modelo: Unknown, Color: Gris, Tipo: Unknown, Source: Camera
            const brandMatch = details.match(/Marca:\s*(.*?),/);
            const modelMatch = details.match(/Modelo:\s*(.*?),/);
            const colorMatch = details.match(/Color:\s*(.*?),/);

            enrichment[plate] = {
                brand: brandMatch ? brandMatch[1].trim() : "Unknown",
                model: modelMatch ? modelMatch[1].trim() : "Unknown",
                color: colorMatch ? colorMatch[1].trim() : "Unknown"
            };
        });

        return enrichment;
    } catch (error) {
        console.error("Enrichment error:", error);
        return {};
    }
}

export async function getLprSyncMap() {
    try {
        const devices = await prisma.device.findMany({
            where: { deviceType: 'LPR_CAMERA' }
        });

        const syncMap: Record<string, string[]> = {};
        const driver = new HikvisionDriver();

        // Normalize helper
        const normalize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

        await Promise.all(devices.map(async (device) => {
            if (device.brand === 'HIKVISION') {
                try {
                    // We use getPlatesPage with a large max or just getPlates if it exists
                    const plates = await driver.getPlates(device);
                    plates.forEach(p => {
                        const plate = normalize(p);
                        if (!plate) return;
                        if (!syncMap[plate]) syncMap[plate] = [];
                        if (!syncMap[plate].includes(device.name)) {
                            syncMap[plate].push(device.name);
                        }
                    });
                } catch (err) {
                    console.error(`Error fetching plates from ${device.name}:`, err);
                }
            }
        }));

        return syncMap;
    } catch (error) {
        console.error("Global Sync Map error:", error);
        return {};
    }
}
