
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importUsers() {
    console.log("--- MIGRATOR V5 (ULTRA-ROBUST) ---");
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
            // 1. Limpieza profunda de datos
            const { id, accessGroups, credentials, vehicles, createdAt, updatedAt, ...userData } = user;

            // Limpiar strings vacíos para evitar errores de unicidad en Prisma
            if (userData.dni && userData.dni.trim() === "") userData.dni = null;
            if (userData.email && userData.email.trim() === "") userData.email = null;
            if (userData.phone === undefined) userData.phone = "N/A";

            // 2. Buscar si ya existe
            const searchConditions = [];
            if (userData.email) searchConditions.push({ email: userData.email });
            if (userData.dni) searchConditions.push({ dni: userData.dni });

            let existing = null;
            if (searchConditions.length > 0) {
                existing = await prisma.user.findFirst({
                    where: { OR: searchConditions },
                    include: { vehicles: true, credentials: true }
                });
            }

            if (existing) {
                console.log(`  [EXISTE] ${user.name}. Sincronizando vehículos/credenciales...`);

                // Vincular Vehículos faltantes
                if (vehicles && vehicles.length > 0) {
                    for (const v of vehicles) {
                        if (!v.plate) continue;
                        const hasPlate = existing.vehicles.some((ev: any) => ev.plate === v.plate);
                        if (!hasPlate) {
                            await prisma.vehicle.create({
                                data: {
                                    plate: v.plate,
                                    brand: v.brand || "LPR",
                                    model: v.model || "IMPORTED",
                                    color: v.color,
                                    type: v.type || "SEDAN",
                                    userId: existing.id
                                }
                            }).catch(e => console.error(`    ! Error vinculando patente ${v.plate}`));
                            updatedRecords++;
                        }
                    }
                }
            } else {
                // 3. Crear nuevo usuario si no existe
                console.log(`  [NUEVO] Creando: ${user.name}`);
                try {
                    await prisma.user.create({
                        data: {
                            ...userData,
                            vehicles: {
                                create: (vehicles || []).map((v: any) => ({
                                    plate: v.plate,
                                    brand: v.brand || "LPR",
                                    model: v.model || "IMPORTED",
                                    color: v.color,
                                    type: v.type || "SEDAN",
                                }))
                            },
                            credentials: {
                                create: (credentials || []).map((c: any) => {
                                    // REGLA DE ORO: El valor es obligatorio
                                    const val = c.value || c.code || (c.type === 'PLATE' ? (vehicles?.[0]?.plate) : null);
                                    if (!val) return null; // Saltar si no hay valor real
                                    return {
                                        type: c.type,
                                        value: String(val),
                                        notes: c.notes || `Importado ${c.type}`
                                    };
                                }).filter(Boolean) as any
                            }
                        }
                    });
                    newRecords++;
                } catch (e: any) {
                    errors++;
                    console.error(`  [ERROR] No se pudo crear a ${user.name}: ${e.message}`);
                }
            }
        }

        console.log("================================================");
        console.log(`RESULTADO FINAL:`);
        console.log(`- Creados: ${newRecords}`);
        console.log(`- Patentes vinculadas: ${updatedRecords}`);
        console.log(`- Errores: ${errors}`);
        console.log("================================================");

    } catch (e) {
        console.error("Error crítico:", e);
    } finally {
        await prisma.$disconnect();
    }
}

importUsers();
