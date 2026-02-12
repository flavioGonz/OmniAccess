"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { addDevicePlate } from "./devices";
import fs from "fs/promises";
import path from "path";
import { uploadToS3 } from "@/lib/s3";

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

export async function getGuardsList() {
    const guards = await prisma.user.findMany({
        where: {
            role: { in: ['STAFF', 'ADMIN'] }
        },
        include: {
            credentials: true
        },
        orderBy: { name: 'asc' }
    });

    return guards.map(g => ({
        ...g,
        password: g.credentials.find(c => c.type === 'PASSWORD')?.value || g.credentials.find(c => c.type === 'PIN')?.value || ''
    }));
}

export async function getAdminsList() {
    const admins = await prisma.user.findMany({
        where: {
            role: 'ADMIN'
        },
        include: {
            credentials: true
        },
        orderBy: { name: 'asc' }
    });

    return admins.map(a => ({
        ...a,
        username: a.name, // Mapping name to username for UI consistency
        password: a.credentials.find(c => c.type === 'PASSWORD')?.value || ''
    }));
}

export async function saveGuard(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const username = formData.get("username") as string;
    const dni = formData.get("dni") as string;
    const password = formData.get("password") as string;
    const photoFile = formData.get("photo") as File | null;
    const currentPhoto = formData.get("currentPhoto") as string;

    let photoPath = currentPhoto;

    // Handle File Upload
    if (photoFile && photoFile.size > 0) {
        try {
            const bytes = await photoFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const fileName = `guard-${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;

            // Upload to S3 (Face bucket)
            photoPath = await uploadToS3(buffer, fileName, photoFile.type || "image/jpeg", "face");
        } catch (error) {
            console.error("Error uploading guard photo:", error);
            throw new Error("Error al subir la foto");
        }
    }

    const data: any = {
        name,
        username: username || name.toLowerCase().replace(/\s+/g, '.'),
        dni,
        cara: photoPath || null
    };

    let user;
    if (id) {
        // When updating by ID (from Admin UI), we can set the role
        data.role = 'STAFF';
        user = await prisma.user.update({
            where: { id },
            data
        });
    } else {
        // Find existing user by name to avoid duplicates
        const existingUser = await prisma.user.findFirst({
            where: { name }
        });

        if (existingUser) {
            // Preserve ADMIN role if it exists
            if (existingUser.role !== 'ADMIN') {
                data.role = 'STAFF';
            }
            user = await prisma.user.update({
                where: { id: existingUser.id },
                data
            });
        } else {
            data.role = 'STAFF';
            user = await prisma.user.create({
                data
            });
        }
    }

    // Handle Password (PASSWORD Type)
    if (password) {
        // Update or Create PASSWORD credential
        const existingPass = await prisma.credential.findFirst({
            where: { userId: user.id, type: 'PASSWORD' }
        });

        if (existingPass) {
            await prisma.credential.update({
                where: { id: existingPass.id },
                data: { value: password }
            });
        } else {
            await prisma.credential.create({
                data: {
                    userId: user.id,
                    type: 'PASSWORD',
                    value: password
                }
            });
        }

        // Also update PIN for backward compatibility if needed, or if the UI uses it as PIN too
        const existingPin = await prisma.credential.findFirst({
            where: { userId: user.id, type: 'PIN' }
        });

        if (existingPin) {
            await prisma.credential.update({
                where: { id: existingPin.id },
                data: { value: password }
            });
        } else {
            await prisma.credential.create({
                data: {
                    userId: user.id,
                    type: 'PIN',
                    value: password
                }
            });
        }
    }

    revalidatePath("/admin/consolas");
    return user;
}

export async function saveAdmin(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const photoFile = formData.get("photo") as File | null;
    const currentPhoto = formData.get("currentPhoto") as string;

    let photoPath = currentPhoto;

    // Handle File Upload
    if (photoFile && photoFile.size > 0) {
        try {
            const bytes = await photoFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const fileName = `admin-${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;

            // Upload to S3 (Face bucket)
            photoPath = await uploadToS3(buffer, fileName, photoFile.type || "image/jpeg", "face");
        } catch (error) {
            console.error("Error uploading admin photo:", error);
            throw new Error("Error al subir la foto");
        }
    }

    const data: any = {
        name, // Username
        email: email || null,
        role: 'ADMIN',
        cara: photoPath || null
    };

    let user;
    if (id) {
        user = await prisma.user.update({
            where: { id },
            data
        });
    } else {
        // Check uniqueness of name (username)
        const existing = await prisma.user.findFirst({ where: { name } });
        if (existing) throw new Error("El nombre de usuario ya existe");

        user = await prisma.user.create({
            data
        });
    }

    // Handle Password
    if (password) {
        // Delete existing password creds
        await prisma.credential.deleteMany({
            where: { userId: user.id, type: 'PASSWORD' }
        });

        await prisma.credential.create({
            data: {
                userId: user.id,
                type: 'PASSWORD',
                value: password
            }
        });
    }

    revalidatePath("/admin/settings");
    return user;
}

export async function deleteAdmin(id: string) {
    // Prevent deleting self? UI handles it usually, or middleware.
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/settings");
}

export async function deleteGuard(id: string) {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/consolas");
}

export async function deleteUser(id: string) {
    await prisma.user.delete({
        where: { id },
    });
    revalidatePath("/admin/users");
}

export async function getQuickCreateData() {
    const [units, groups, devices, parkingSlots] = await Promise.all([
        prisma.unit.findMany({ orderBy: { name: 'asc' } }),
        prisma.accessGroup.findMany({ include: { devices: true }, orderBy: { name: 'asc' } }),
        prisma.device.findMany({ orderBy: { name: 'asc' } }),
        prisma.parkingSlot.findMany({ include: { user: true }, orderBy: { label: 'asc' } })
    ]);
    return { units, groups, devices, parkingSlots };
}

export async function createUser(formData: FormData) {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const role = formData.get("role") as UserRole;
    const unitId = formData.get("unitId") as string;
    const cara = formData.get("cara") as string; // Optional snapshot path

    // Optional fields
    const plate = formData.get("plate") as string;
    const accessTags = formData.get("accessTags") as string;
    const pin = formData.get("pin") as string;

    const apartment = formData.get("apartment") as string;
    const parkingSlotId = formData.get("parkingSlotId") as string;


    const userPayload: any = {
        name,
        email,
        phone: phone || null,
        role,
        cara: cara || null,
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
        phone: phone || null,
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

export async function importUserBatch(users: any[]) {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const u of users) {
        try {
            // Normalize DNI
            if (!u.Name || !u.DNI) {
                failCount++;
                errors.push(`Fila inválida: Falta Nombre o DNI`);
                continue;
            }

            // Find or Upsert Unit
            let unitId = null;
            if (u.Unidad) {
                const unitName = u.Unidad.toString().trim();
                const unit = await prisma.unit.findFirst({
                    where: { name: { equals: unitName, mode: 'insensitive' } }
                });
                if (unit) unitId = unit.id;
            }

            // Upsert User
            // Look for existing user by DNI
            let user = await prisma.user.findFirst({
                where: { dni: u.DNI.toString() }
            });

            if (user && user.role === 'ADMIN') {
                // Skip overwriting admins via batch import to protect system integrity
                successCount++;
                continue;
            }

            const userData = {
                name: u.Name,
                dni: u.DNI.toString(),
                email: u.Email || null,
                phone: u.Phone ? u.Phone.toString() : null,
                role: (['RESIDENT', 'VISITOR', 'STAFF', 'ADMIN', 'PROVIDER'].includes(u.Role) ? u.Role : 'RESIDENT') as UserRole,
                unitId: unitId,
                cara: u.FaceURL || null,
            };

            if (user) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: userData
                });
            } else {
                user = await prisma.user.create({
                    data: userData
                });
            }

            // Handle Credentials

            // 1. Tags
            if (u.Tags) {
                const tags = u.Tags.toString().split(',').map((t: string) => t.trim()).filter((t: string) => t);
                for (const tag of tags) {
                    const exists = await prisma.credential.findFirst({
                        where: { type: 'TAG', value: tag, userId: user.id }
                    });
                    if (!exists) {
                        const existsGlobal = await prisma.credential.findFirst({ where: { type: 'TAG', value: tag } });
                        if (!existsGlobal) {
                            await prisma.credential.create({
                                data: { type: 'TAG', value: tag, userId: user.id, notes: 'Importado Excel' }
                            });
                        }
                    }
                }
            }

            // 2. Plates
            if (u.Plates) {
                const plates = u.Plates.toString().split(',').map((p: string) => p.trim().toUpperCase()).filter((p: string) => p);
                for (const plate of plates) {
                    // Ensure Vehicle
                    const existsVehicle = await prisma.vehicle.findUnique({ where: { plate } });
                    if (!existsVehicle) {
                        await prisma.vehicle.create({
                            data: { plate, userId: user.id, type: 'SEDAN', brand: "Importado" }
                        });
                    }

                    // Ensure Credential
                    const existsCred = await prisma.credential.findFirst({ where: { type: 'PLATE', value: plate } });
                    if (!existsCred) {
                        await prisma.credential.create({
                            data: { type: 'PLATE', value: plate, userId: user.id, notes: 'Importado Excel' }
                        });
                    }
                }
            }

            // 3. Face (if processed from upload as credential)
            if (u.FaceURL || (u.HasFace === 'YES')) {
                const existsFace = await prisma.credential.findFirst({
                    where: { type: 'FACE', userId: user.id }
                });
                if (!existsFace) {
                    await prisma.credential.create({
                        data: { type: 'FACE', value: user.dni || user.id, userId: user.id, notes: 'Importado Excel (Auto)' }
                    });
                }
            }

            successCount++;

        } catch (e: any) {
            console.error(e);
            failCount++;
            errors.push(`Error en fila de ${u.Name || 'Desconocido'}: ${e.message}`);
        }
    }

    revalidatePath("/admin/users");
    return { success: true, count: successCount, failed: failCount, errors };
}