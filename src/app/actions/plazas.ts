"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import * as fs from 'fs';
import * as path from 'path';

export async function getParkingSlots() {
    try {
        const slots = await prisma.parkingSlot.findMany({
            orderBy: { createdAt: 'asc' }
        });

        // Parse points JSON string to array
        return slots.map(slot => ({
            ...slot,
            points: slot.points ? JSON.parse(slot.points) : []
        }));
    } catch (error) {
        console.error("Error fetching parking slots:", error);
        return [];
    }
}

export async function saveParkingSlots(slots: any[]) {
    try {
        // Delete all existing slots
        await prisma.parkingSlot.deleteMany({});

        // Create new slots with polygon format
        for (const slot of slots) {
            await prisma.parkingSlot.create({
                data: {
                    id: slot.id,
                    label: slot.label,
                    isOccupied: slot.isOccupied || false,
                    unitId: slot.unitId || null,
                    // Store polygon points as JSON
                    points: JSON.stringify(slot.points || []),
                    // Legacy fields for backward compatibility
                    x: slot.points?.[0]?.x || 0,
                    y: slot.points?.[0]?.y || 0,
                    width: 0,
                    height: 0
                }
            });
        }

        revalidatePath("/admin/plazas");
        return { success: true, message: "Configuración guardada exitosamente" };
    } catch (error: any) {
        console.error("Error saving parking slots:", error);
        return { success: false, error: error.message || "Failed to save slots" };
    }
}

export async function updateSlotStatus(id: string, isOccupied: boolean) {
    try {
        await prisma.parkingSlot.update({
            where: { id },
            data: { isOccupied }
        });
        revalidatePath("/admin/plazas");
        return { success: true };
    } catch (error) {
        console.error("Error updating slot status:", error);
        return { success: false };
    }
}

export async function getParkingMap() {
    const setting = await prisma.setting.findUnique({ where: { key: "parking_map_url" } });
    return setting?.value || null;
}

import { uploadToS3 } from "@/lib/s3";

export async function uploadParkingMap(formData: FormData) {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file provided");

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `maps/parking_map_${Date.now()}.png`;
    const url = await uploadToS3(buffer, filename, file.type || "image/png", "lpr");

    await prisma.setting.upsert({
        where: { key: "parking_map_url" },
        update: { value: url },
        create: { key: "parking_map_url", value: url }
    });

    revalidatePath("/admin/plazas");
    return url;
}
