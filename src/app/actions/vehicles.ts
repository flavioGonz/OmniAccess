"use server";

import { prisma } from "@/lib/prisma";
import { Vehicle } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getVehicles(skip: number = 0, take: number = 20, query?: string) {
    try {
        const where = query ? {
            OR: [
                { plate: { contains: query.toUpperCase() } },
                { brand: { contains: query, mode: 'insensitive' as any } },
                { model: { contains: query, mode: 'insensitive' as any } },
                { user: { name: { contains: query, mode: 'insensitive' as any } } },
            ]
        } : {};

        const [vehicles, total] = await Promise.all([
            prisma.vehicle.findMany({
                where,
                include: {
                    user: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take,
                distinct: ['id'],
            }),
            prisma.vehicle.count({ where })
        ]);

        return { vehicles, total };
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        return { vehicles: [], total: 0 };
    }
}

export async function createVehicle(data: any) {
    try {
        const vehicle = await prisma.vehicle.create({
            data: {
                plate: data.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                brand: data.brand,
                model: data.model,
                color: data.color,
                type: data.type || "SEDAN",
                notes: data.notes,
                userId: data.userId,
            },
        });

        // Also create a credential for this plate if it doesn't exist
        const credentialExists = await prisma.credential.findFirst({
            where: { value: vehicle.plate, type: "PLATE" }
        });

        if (!credentialExists) {
            await prisma.credential.create({
                data: {
                    type: "PLATE",
                    value: vehicle.plate,
                    userId: data.userId,
                }
            });
        }

        revalidatePath("/admin/vehicles");
        return { success: true, vehicle };
    } catch (error: any) {
        console.error("Error creating vehicle:", error);
        return { success: false, error: error.message };
    }
}

export async function updateVehicle(id: string, data: any) {
    try {
        const vehicle = await prisma.vehicle.update({
            where: { id },
            data: {
                plate: data.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                brand: data.brand,
                model: data.model,
                color: data.color,
                type: data.type,
                notes: data.notes,
                userId: data.userId,
            },
        });
        revalidatePath("/admin/vehicles");
        return { success: true, vehicle };
    } catch (error: any) {
        console.error("Error updating vehicle:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteVehicle(id: string) {
    try {
        await prisma.vehicle.delete({
            where: { id },
        });
        revalidatePath("/admin/vehicles");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting vehicle:", error);
        return { success: false, error: error.message };
    }
}

export async function getVehicleHistory(plate: string) {
    try {
        const events = await prisma.accessEvent.findMany({
            where: {
                OR: [
                    { plateDetected: plate },
                    { plateNumber: plate }
                ]
            },
            include: {
                device: true,
                user: true
            },
            orderBy: {
                timestamp: "desc"
            },
            take: 50
        });
        return { success: true, events };
    } catch (error: any) {
        console.error("Error fetching vehicle history:", error);
        return { success: false, error: error.message, events: [] };
    }
}
