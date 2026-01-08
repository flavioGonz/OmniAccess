"use server";

import { prisma } from "@/lib/prisma";

export async function getAccessEvents(options?: {
    take?: number,
    skip?: number,
    search?: string,
    decision?: "GRANT" | "DENY" | "ALL",
    type?: "PLATE" | "FACE" | "TAG" | "ALL",
    direction?: "ENTRY" | "EXIT" | "ALL",
    unit?: string,
    from?: Date,
    to?: Date
}) {
    const whereClause: any = {};

    if (options?.decision && options.decision !== "ALL") {
        whereClause.decision = options.decision;
    }

    if (options?.type && options.type !== "ALL") {
        whereClause.accessType = options.type;
    }

    if (options?.direction && options.direction !== "ALL") {
        whereClause.direction = options.direction;
    }

    if (options?.unit) {
        whereClause.user = {
            unit: {
                name: { contains: options.unit, mode: 'insensitive' }
            }
        };
    }

    if (options?.search) {
        const search = options.search.toLowerCase();
        // search logic (plate OR user name OR device name OR unit name)
        whereClause.OR = [
            { plateDetected: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { unit: { name: { contains: search, mode: 'insensitive' } } } },
            { device: { name: { contains: search, mode: 'insensitive' } } }
        ];
    }

    if (options?.from || options?.to) {
        whereClause.timestamp = {};
        if (options.from) whereClause.timestamp.gte = options.from;
        if (options.to) whereClause.timestamp.lte = options.to;
    }

    try {
        const [events, total] = await Promise.all([
            prisma.accessEvent.findMany({
                where: whereClause,
                take: options?.take ?? 50,
                skip: options?.skip ?? 0,
                orderBy: { timestamp: "desc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            dni: true,
                            apartment: true,
                            cara: true,
                            unit: {
                                select: { name: true }
                            },
                            parkingSlotId: true
                        }
                    },
                    device: true,
                },
            }),
            prisma.accessEvent.count({ where: whereClause })
        ]);

        // Enrich events with duration logic (Keep inside try block as it depends on events)
        const enrichedEvents = await Promise.all(events.map(async (event) => {
            // Para eventos LPR, usar la patente
            const plate = event.plateDetected?.trim();
            // Para eventos faciales, usar el userId
            const userId = event.userId;

            // Si no hay identificador válido, no calcular duración
            if ((!plate || plate === 'unknown' || plate === 'NO_LEIDA') && !userId) {
                return { ...event, stayDuration: null, previousDirection: null };
            }

            // Buscar evento previo basado en el tipo de acceso
            let previousEvent;

            if (event.accessType === 'FACE' && userId) {
                // Para eventos faciales, buscar por userId
                previousEvent = await prisma.accessEvent.findFirst({
                    where: {
                        userId: userId,
                        timestamp: { lt: event.timestamp },
                        accessType: 'FACE'
                    },
                    orderBy: { timestamp: 'desc' }
                });
            } else if (event.accessType === 'PLATE' && plate) {
                // Para eventos LPR, buscar por patente
                previousEvent = await prisma.accessEvent.findFirst({
                    where: {
                        plateDetected: { equals: plate, mode: 'insensitive' },
                        timestamp: { lt: event.timestamp }
                    },
                    orderBy: { timestamp: 'desc' }
                });
            }

            if (!previousEvent) {
                return { ...event, stayDuration: null, previousDirection: null };
            }

            const durationMs = event.timestamp.getTime() - previousEvent.timestamp.getTime();

            return {
                ...event,
                stayDuration: durationMs,
                previousDirection: previousEvent.direction
            };
        }));

        return { events: enrichedEvents, total };

    } catch (error) {
        console.error("Database connection error in getAccessEvents:", error);
        return { events: [], total: 0 };
    }
}

export async function getEventsCountToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    try {
        const [total, grants, denies] = await Promise.all([
            prisma.accessEvent.count({
                where: { timestamp: { gte: startOfDay } }
            }),
            prisma.accessEvent.count({
                where: {
                    timestamp: { gte: startOfDay },
                    decision: "GRANT"
                }
            }),
            prisma.accessEvent.count({
                where: {
                    timestamp: { gte: startOfDay },
                    decision: "DENY"
                }
            })
        ]);
        return { total, grants, denies };
    } catch (error) {
        console.error("Database connection error in getEventsCountToday:", error);
        return { total: 0, grants: 0, denies: 0 };
    }
}

export async function getRelatedSessionEvents(eventId: string) {
    try {
        const event = await prisma.accessEvent.findUnique({
            where: { id: eventId },
            select: { timestamp: true, deviceId: true }
        });

        if (!event || !event.deviceId) return [];

        // Find events +/- 1 minute from the same device
        const windowMs = 60 * 1000;
        const startWindow = new Date(event.timestamp.getTime() - windowMs);
        const endWindow = new Date(event.timestamp.getTime() + windowMs);

        const related = await prisma.accessEvent.findMany({
            where: {
                deviceId: event.deviceId,
                timestamp: {
                    gte: startWindow,
                    lte: endWindow
                }
            },
            orderBy: { timestamp: 'asc' },
            include: {
                user: {
                    select: { name: true }
                }
            }
        });

        return related;
    } catch (error) {
        console.error("Database connection error in getRelatedSessionEvents:", error);
        return [];
    }
}
