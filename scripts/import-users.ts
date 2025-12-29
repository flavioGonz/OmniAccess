
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

        for (const user of users) {
            console.log(`Processing user: ${user.name} (${user.email || 'No Email'})`);

            // 1. Check if user exists
            const existing = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: user.email },
                        { dni: user.dni } // Assuming DNI is unique too
                    ]
                }
            });

            if (existing) {
                console.log(`  -> User already exists (ID: ${existing.id}). Skipping.`);
                continue;
            }

            // 2. Prepare data for creation
            // We need to detach ID to let Prisma generate a new one if we want to avoid conflicts, 
            // OR keep it if we are sure. Let's regenerate ID to be safe and avoid primary key collisions if prod isn't empty.
            // But we need to handle relations.

            const { id, groups, credentials, vehicles, ...userData } = user;

            // TODO: Groups handling. We need to find valid Group IDs in DB or create them.
            // For now, let's skip group linking or try to find by name if Group model has unique name.
            // Assuming AccessGroup has 'name'.

            try {
                const newUser = await prisma.user.create({
                    data: {
                        ...userData,
                        // Re-create vehicles
                        vehicles: {
                            create: vehicles.map((v: any) => ({
                                plate: v.plate,
                                brand: v.brand,
                                model: v.model,
                                color: v.color,
                                type: v.type,
                                // photos...
                            }))
                        },
                        // Re-create credentials
                        credentials: {
                            create: credentials.map((c: any) => ({
                                type: c.type,
                                code: c.code,
                                status: c.status,
                                // ... other fields except ID and userId
                            }))
                        }
                    }
                });
                console.log(`  -> Created user: ${newUser.id}`);
            } catch (createError) {
                console.error(`  -> Failed to create user ${user.name}:`, createError);
            }
        }

        console.log("Import completed.");

    } catch (e) {
        console.error("Error importing users:", e);
    } finally {
        await prisma.$disconnect();
    }
}

importUsers();
