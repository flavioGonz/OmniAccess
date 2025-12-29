"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";

export async function getUsers(options?: { take?: number, skip?: number }) {
    const users = await prisma.user.findMany({
        include: {
            unit: true,
            credentials: true,
            accessGroups: {
                include: {
                    devices: true
                }
            },
            vehicles: true,
            parkingSlot: true,
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: options?.take,
        skip: options?.skip
    });
    return users;
}

export async function getUsersCount() {
    return await prisma.user.count();
}

export async function deleteUser(id: string) {
    await prisma.user.delete({
        where: { id },
    });
    revalidatePath("/admin/users");
}

export async function createUser(formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const role = formData.get("role") as UserRole;
    const unitId = formData.get("unitId") as string;

    // Optional fields
    const plate = formData.get("plate") as string;
    const accessTags = formData.get("accessTags") as string;
    const pin = formData.get("pin") as string;

    const apartment = formData.get("apartment") as string;
    const parkingSlotId = formData.get("parkingSlotId") as string;

    const userPayload: any = {
        name,
        email,
        phone,
        role,
        apartment: apartment || null,
        parkingSlotId: (parkingSlotId && parkingSlotId !== "none") ? parkingSlotId : null,
    };

    if (unitId && unitId !== "none") {
        userPayload.unitId = unitId;
    }

    const newUser = await prisma.user.create({
        data: userPayload,
    });

    // Handle Vehicle/Plate creation if provided
    if (plate && plate.trim() !== "") {
        await prisma.vehicle.create({
            data: {
                plate: plate.toUpperCase().trim(),
                type: 'SEDAN', // Default type, can be enhanced later
                userId: newUser.id
            }
        });

        // Also add as explicit PLATE credential
        await prisma.credential.create({
            data: {
                type: 'PLATE',
                value: plate.toUpperCase().trim(),
                userId: newUser.id
            }
        });
    }

    // Handle Access Tags (RFID) creation
    if (accessTags && accessTags.trim() !== "") {
        const tags = accessTags.split(',').map(t => t.trim()).filter(t => t !== "");
        if (tags.length > 0) {
            await prisma.credential.createMany({
                data: tags.map(tag => ({
                    type: 'TAG',
                    value: tag,
                    userId: newUser.id
                }))
            });
        }
    }

    // Handle PIN creation if provided
    if (pin && pin.trim() !== "") {
        await prisma.credential.create({
            data: {
                type: 'PIN',
                value: pin.trim(),
                userId: newUser.id
            }
        });
    }

    // Handle Groups (if strictly needed from form, but usually handled separately or default)
    // For now we assume groups are managed via edit or default logic if any

    revalidatePath("/admin/users");
    return newUser;
}

export async function updateUser(id: string, formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const role = formData.get("role") as UserRole;
    const unitId = formData.get("unitId") as string;

    const plate = formData.get("plate") as string;
    const accessTags = formData.get("accessTags") as string;
    const pin = formData.get("pin") as string;

    const apartment = formData.get("apartment") as string;
    const parkingSlotId = formData.get("parkingSlotId") as string;

    const userPayload: any = {
        name,
        email,
        phone,
        role,
        apartment: apartment || null,
        parkingSlotId: (parkingSlotId && parkingSlotId !== "none") ? parkingSlotId : null,
    };

    if (unitId && unitId !== "none") {
        userPayload.unitId = unitId;
    } else {
        userPayload.unitId = null;
    }

    const updatedUser = await prisma.user.update({
        where: { id },
        data: userPayload,
    });

    // Update or Create Vehicle/Plate
    if (plate !== null) {
        const existingVehicle = await prisma.vehicle.findFirst({
            where: { userId: id }
        });

        if (plate.trim() === "") {
            if (existingVehicle) {
                await prisma.vehicle.delete({ where: { id: existingVehicle.id } });
            }
            await prisma.credential.deleteMany({
                where: { userId: id, type: 'PLATE' }
            });
        } else {
            if (existingVehicle) {
                await prisma.vehicle.update({
                    where: { id: existingVehicle.id },
                    data: { plate: plate.toUpperCase().trim() }
                });
            } else {
                await prisma.vehicle.create({
                    data: {
                        plate: plate.toUpperCase().trim(),
                        type: 'SEDAN',
                        userId: id
                    }
                });
            }
            const existingCred = await prisma.credential.findFirst({
                where: { userId: id, type: 'PLATE' }
            });
            if (existingCred) {
                await prisma.credential.update({
                    where: { id: existingCred.id },
                    data: { value: plate.toUpperCase().trim() }
                });
            } else {
                await prisma.credential.create({
                    data: {
                        type: 'PLATE',
                        value: plate.toUpperCase().trim(),
                        userId: id
                    }
                });
            }
        }
    }

    // Update or Create Access Tags (RFID)
    if (accessTags !== null) {
        // We replace all tags to ensure sync with the list provided in the form

        // 1. Delete existing TAGs for this user
        await prisma.credential.deleteMany({
            where: { userId: id, type: 'TAG' }
        });

        // 2. Create new tags from the list
        if (accessTags.trim() !== "") {
            const tags = accessTags.split(',').map(t => t.trim()).filter(t => t !== "");
            if (tags.length > 0) {
                await prisma.credential.createMany({
                    data: tags.map(tag => ({
                        type: 'TAG',
                        value: tag,
                        userId: id
                    }))
                });
            }
        }
    }

    // Update or Create PIN
    if (pin !== null) {
        const existingPin = await prisma.credential.findFirst({
            where: { userId: id, type: 'PIN' }
        });

        if (pin.trim() === "") {
            if (existingPin) {
                await prisma.credential.delete({ where: { id: existingPin.id } });
            }
        } else {
            if (existingPin) {
                await prisma.credential.update({
                    where: { id: existingPin.id },
                    data: { value: pin.trim() }
                });
            } else {
                await prisma.credential.create({
                    data: {
                        type: 'PIN',
                        value: pin.trim(),
                        userId: id
                    }
                });
            }
        }
    }

    revalidatePath("/admin/users");
    return updatedUser;
}

export async function deleteAllUsers() {
    try {
        await prisma.user.deleteMany({});
        revalidatePath('/admin/users');
        return true;
    } catch (error) {
        console.error("Failed to delete all users:", error);
        throw new Error("Failed to delete all users");
    }
}