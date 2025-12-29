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

    if (options?.from && options?.to) {
        whereClause.timestamp = {
            gte: options.from,
            lte: options.to
        };
    }

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
                        unit: true,
                        parkingSlotId: true
                    }
                },
                device: true,
            },
        }),
        prisma.accessEvent.count({ where: whereClause })
    ]);

    return { events, total };
}

export async function getEventsCountToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

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
}
