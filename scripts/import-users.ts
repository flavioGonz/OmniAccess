
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importUsers() {
    console.log("--- MIGRATOR V6 (SAFE PLATES) ---");
    try {
        const importPath = path.join(process.cwd(), 'users_export.json');

        if (!fs.existsSync(importPath)) {
            console.error("Archivo users_export.json no encontrado!");
            return;
        }

        const data = fs.readFileSync(importPath, 'utf-8');
        const users = JSON.parse(data);

        console.log(`Cargados ${users.length} usuarios del archivo.`);

        let newRecords = 0;
        let updatedRecords = 0;
        let errors = 0;

        for (const user of users) {
            const { id, accessGroups, credentials, vehicles, createdAt, updatedAt, ...userData } = user;

            if (userData.dni && userData.dni.trim() === "") userData.dni = null;
            if (userData.email && userData.email.trim() === "") userData.email = null;
            if (!userData.phone) userData.phone = "N/A";

            const searchConditions = [];
            if (userData.email) searchConditions.push({ email: userData.email });
            if (userData.dni) searchConditions.push({ dni: userData.dni });

            let existing = null;
            if (searchConditions.length > 0) {
                existing = await prisma.user.findFirst({
                    where: { OR: searchConditions },
                    include: { vehicles: true }
                });
            }

            let targetUserId = existing?.id;

            if (!existing) {
                // CREAR USUARIO PRIMERO
                try {
                    const newUser = await prisma.user.create({ data: userData });
                    targetUserId = newUser.id;
                    newRecords++;
                    console.log(`  [NUEVO] ${user.name}`);
                } catch (e: any) {
                    errors++;
                    console.error(`  [ERROR] No se pudo crear a ${user.name}: ${e.message}`);
                    continue;
                }
            } else {
                console.log(`  [EXISTE] ${user.name}. Sincronizando...`);
            }

            // PROCESAR VEHÍCULOS UNO POR UNO (SI FALLA UNO, LOS DEMÁS SIGUEN)
            if (vehicles && vehicles.length > 0 && targetUserId) {
                for (const v of vehicles) {
                    if (!v.plate) continue;
                    try {
                        const plateExists = await prisma.vehicle.findUnique({ where: { plate: v.plate } });
                        if (!plateExists) {
                            await prisma.vehicle.create({
                                data: {
                                    plate: v.plate,
                                    brand: v.brand || "LPR",
                                    model: v.model || "IMPORTED",
                                    color: v.color,
                                    type: v.type || "SEDAN",
                                    userId: targetUserId
                                }
                            });
                            updatedRecords++;
                            console.log(`     + Patente ${v.plate} vinculada.`);
                        }
                    } catch (err) {
                        // Si falla una patente, no detenemos el bucle
                    }
                }
            }

            // PROCESAR CREDENCIALES
            if (credentials && credentials.length > 0 && targetUserId) {
                for (const c of credentials) {
                    const val = c.value || c.code || (c.type === 'PLATE' ? vehicles?.[0]?.plate : null);
                    if (!val) continue;
                    try {
                        const hasCred = await prisma.credential.findFirst({
                            where: { userId: targetUserId, value: String(val) }
                        });
                        if (!hasCred) {
                            await prisma.credential.create({
                                data: {
                                    type: c.type,
                                    value: String(val),
                                    notes: c.notes || `Importado ${c.type}`,
                                    userId: targetUserId
                                }
                            });
                        }
                    } catch (e) { }
                }
            }
        }

        console.log("================================================");
        console.log(`RESULTADO V6:`);
        console.log(`- Usuarios creados: ${newRecords}`);
        console.log(`- Patentes vinculadas/nuevas: ${updatedRecords}`);
        console.log(`- Errores de creación: ${errors}`);
        console.log("================================================");

    } catch (e) {
        console.error("Error crítico:", e);
    } finally {
        await prisma.$disconnect();
    }
}

importUsers();
