"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

import { UnitType } from "@prisma/client";

export async function createUnit(formData: FormData) {
    const name = formData.get("name") as string;
    const type = formData.get("type") as UnitType; // BARRIO, EDIFICIO, CASA
    const floors = formData.get("floors") ? parseInt(formData.get("floors") as string) : null;
    const lot = formData.get("lot") as string;
    const houseNumber = formData.get("houseNumber") as string;
    const address = formData.get("address") as string;
    const adminPhone = formData.get("adminPhone") as string;
    const deviceCount = formData.get("deviceCount") ? parseInt(formData.get("deviceCount") as string) : 0;
    const deviceType = formData.get("deviceType") as string;
    const coordinates = formData.get("coordinates") as string;

    // Description can be mapped from address or kept empty
    const description = address ? `Ubicado en ${address}` : null;

    await prisma.unit.create({
        data: {
            name,
            description,
            type: type || 'EDIFICIO',
            floors,
            lot,
            houseNumber,
            address,
            adminPhone,
            deviceCount,
            deviceType,
            coordinates
        },
    });

    revalidatePath("/admin/units");
}

export async function updateUnit(id: string, formData: FormData) {
    const name = formData.get("name") as string;
    const type = formData.get("type") as UnitType;
    const floors = formData.get("floors") ? parseInt(formData.get("floors") as string) : null;
    const lot = formData.get("lot") as string;
    const houseNumber = formData.get("houseNumber") as string;
    const address = formData.get("address") as string;
    const adminPhone = formData.get("adminPhone") as string;
    const deviceCount = formData.get("deviceCount") ? parseInt(formData.get("deviceCount") as string) : 0;
    const deviceType = formData.get("deviceType") as string;
    const coordinates = formData.get("coordinates") as string;

    const description = address ? `Ubicado en ${address}` : null;

    await prisma.unit.update({
        where: { id },
        data: {
            name,
            description,
            type: type || 'EDIFICIO',
            floors,
            lot,
            houseNumber,
            address,
            adminPhone,
            deviceCount,
            deviceType,
            coordinates
        },
    });

    revalidatePath("/admin/units");
}

export async function deleteUnit(id: string) {
    await prisma.unit.delete({ where: { id } });
    revalidatePath("/admin/units");
}

export async function getUnits() {
    return await prisma.unit.findMany({
        orderBy: { name: 'asc' }
    });
}

export async function getUnitsWithDetails() {
    return await prisma.unit.findMany({
        include: {
            users: {
                include: {
                    credentials: {
                        where: { type: 'PLATE' }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });
}
