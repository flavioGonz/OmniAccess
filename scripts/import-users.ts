
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importUsers() {
    try {
        const importPath = path.join(process.cwd(), 'users_export.json');

        if (!fs.existsSync(importPath)) {
            console.error("File users_export.json not found!");
            return;
        }

        const data = fs.readFileSync(importPath, 'utf-8');
        const users = JSON.parse(data);

        console.log(`Loaded ${users.length} users from file.`);

        let newRecords = 0;
        let updatedRecords = 0;

        for (const user of users) {
            // 1. Check if user exists
            let existing = await prisma.user.findFirst({
                where: {
                    OR: [
                        user.email ? { email: user.email } : undefined,
                        user.dni ? { dni: user.dni } : undefined
                    ].filter(Boolean) as any
                },
                include: {
                    vehicles: true,
                    credentials: true
                }
            });

            // Clean data for processing
            const { id, accessGroups, credentials, vehicles, ...userData } = user;

            // Filter invalid data (empty strings that should be null)
            if (userData.dni === "") userData.dni = null;
            if (userData.email === "") userData.email = null;

            if (existing) {
                console.log(`  [UPDATE] User ${user.name} exists. Checking vehicles & credentials...`);

                // Add missing vehicles
                if (vehicles && vehicles.length > 0) {
                    for (const v of vehicles) {
                        const hasPlate = existing.vehicles.some((ev: any) => ev.plate === v.plate);
                        if (!hasPlate) {
                            try {
                                await prisma.vehicle.create({
                                    data: {
                                        plate: v.plate,
                                        brand: v.brand,
                                        model: v.model,
                                        color: v.color,
                                        type: v.type,
                                        userId: existing.id
                                    }
                                });
                                console.log(`     + Added plate ${v.plate} to ${user.name}`);
                                updatedRecords++;
                            } catch (err) {
                                console.error(`     ! Failed to add plate ${v.plate}:`, err);
                            }
                        }
                    }
                }

                // Add missing credentials
                if (credentials && credentials.length > 0) {
                    for (const c of credentials) {
                        const credentialValue = c.value || c.code; // Fallback if name is different
                        if (!credentialValue) continue;

                        const hasCred = existing.credentials.some((ec: any) => ec.value === credentialValue);
                        if (!hasCred) {
                            try {
                                await prisma.credential.create({
                                    data: {
                                        type: c.type,
                                        value: credentialValue,
                                        notes: c.notes || `Migrated ${c.type}`,
                                        userId: existing.id
                                    }
                                });
                                console.log(`     + Added credential ${credentialValue} to ${user.name}`);
                            } catch (err) {
                                console.error(`     ! Failed to add credential:`, err);
                            }
                        }
                    }
                }

            } else {
                console.log(`  [CREATE] Creating new user: ${user.name}`);

                try {
                    const newUser = await prisma.user.create({
                        data: {
                            ...userData,
                            // Create vehicles
                            vehicles: {
                                create: (vehicles || []).map((v: any) => ({
                                    plate: v.plate,
                                    brand: v.brand,
                                    model: v.model,
                                    color: v.color,
                                    type: v.type,
                                }))
                            },
                            // Create credentials
                            credentials: {
                                create: (credentials || []).map((c: any) => {
                                    const val = c.value || c.code || (c.type === 'PLATE' ? vehicles?.[0]?.plate : undefined);
                                    if (!val) {
                                        // If still no value, we mock it to avoid the 'value missing' error 
                                        // but ideally the export should have it.
                                        return null;
                                    }
                                    return {
                                        type: c.type,
                                        value: val,
                                        notes: c.notes || `Imported ${c.type}`
                                    };
                                }).filter(Boolean) as any
                            }
                        }
                    });
                    newRecords++;
                } catch (createError) {
                    console.error(`  -> Failed to create user ${user.name}:`, createError);
                }
            }
        }

        console.log("------------------------------------------------");
        console.log(`Import completed. Created: ${newRecords}, Updated: ${updatedRecords}`);

    } catch (e) {
        console.error("Error importing users:", e);
    } finally {
        await prisma.$disconnect();
    }
}

importUsers();
