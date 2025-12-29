
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importUsers() {
    console.log("--- MIGRATOR V7 (REASSIGN PLATES) ---");
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
        let reassignedPlates = 0;
        let errors = 0;

        // Buscar el usuario "MATRICULAS IMPORTADAS" para saber qué reasignar
        const dummyUser = await prisma.user.findFirst({ where: { name: "MATRICULAS IMPORTADAS" } });

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

            // PROCESAR VEHÍCULOS Y REASIGNAR SI ES NECESARIO
            if (vehicles && vehicles.length > 0 && targetUserId) {
                for (const v of vehicles) {
                    if (!v.plate) continue;
                    try {
                        const plateExists = await prisma.vehicle.findUnique({ where: { plate: v.plate } });

                        if (!plateExists) {
                            // Crear nueva
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
                            console.log(`     + Patente ${v.plate} creada.`);
                        } else if (plateExists.userId !== targetUserId) {
                            // SI EXISTE PERO ES DE OTRO (o del Dummy), REASIGNAR
                            await prisma.vehicle.update({
                                where: { plate: v.plate },
                                data: { userId: targetUserId }
                            });

                            // También reasignar la Credencial si existe
                            await prisma.credential.updateMany({
                                where: { value: v.plate, type: 'PLATE' },
                                data: { userId: targetUserId }
                            });

                            reassignedPlates++;
                            console.log(`     => Patente ${v.plate} REASIGNADA a ${user.name}.`);
                        }
                    } catch (err) {
                        console.error(`     ! Error con plate ${v.plate}:`, err);
                    }
                }
            }

            // CREDENCIALES
            if (credentials && credentials.length > 0 && targetUserId) {
                for (const c of credentials) {
                    const val = c.value || c.code || (c.type === 'PLATE' ? vehicles?.[0]?.plate : null);
                    if (!val) continue;
                    try {
                        const hasCred = await prisma.credential.findFirst({
                            where: { value: String(val), type: c.type }
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
                        } else if (hasCred.userId !== targetUserId) {
                            await prisma.credential.update({
                                where: { id: hasCred.id },
                                data: { userId: targetUserId }
                            });
                        }
                    } catch (e) { }
                }
            }
        }

        console.log("================================================");
        console.log(`RESULTADO FINAL V7:`);
        console.log(`- Usuarios Nuevos: ${newRecords}`);
        console.log(`- Patentes Creadas: ${updatedRecords}`);
        console.log(`- Patentes REASIGNADAS: ${reassignedPlates}`);
        console.log(`- Errores: ${errors}`);
        console.log("================================================");

    } catch (e) {
        console.error("Error crítico:", e);
    } finally {
        await prisma.$disconnect();
    }
}

importUsers();
