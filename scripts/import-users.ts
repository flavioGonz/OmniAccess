
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
                        { email: user.email },
                        { dni: user.dni }
                    ]
                },
                include: { vehicles: true }
            });

            // Clean data for processing
            const { id, accessGroups, credentials, vehicles, ...userData } = user;

            // Filter invalid data (empty strings that should be null)
            if (userData.dni === "") userData.dni = null;
            if (userData.email === "") userData.email = null;

            if (existing) {
                console.log(`  [UPDATE] User ${user.name} exists. Checking vehicles...`);

                // Add missing vehicles
                if (vehicles && vehicles.length > 0) {
                    for (const v of vehicles) {
                        // Check if user already has this plate
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

            } else {
                console.log(`  [CREATE] Creating new user: ${user.name}`);

                try {
                    const newUser = await prisma.user.create({
                        data: {
                            ...userData,
                            // Create vehicles
                            vehicles: {
                                create: vehicles ? vehicles.map((v: any) => ({
                                    plate: v.plate,
                                    brand: v.brand,
                                    model: v.model,
                                    color: v.color,
                                    type: v.type,
                                    // photos optional
                                })) : []
                            },
                            // Create credentials
                            credentials: {
                                create: credentials ? credentials.map((c: any) => ({
                                    type: c.type,
                                    code: c.code,
                                    status: c.status,
                                    facilityCode: c.facilityCode
                                })) : []
                            }
                            // We are NOT linking accessGroups by default to avoid ID conflicts, 
                            // unless you want to match by name.
                        }
                    });
                    newRecords++;
                } catch (createError) {
                    console.error(`  -> Failed to create user ${user.name}:`, createError);
                }
            }
        }

        console.log("------------------------------------------------");
        console.log(`Import completed. Created: ${newRecords}, Updated (Vehicles): ${updatedRecords}`);

    } catch (e) {
        console.error("Error importing users:", e);
    } finally {
        await prisma.$disconnect();
    }
}

importUsers();
