"use server";
import { prisma } from "@/lib/prisma";

export async function getParkingSlots() {
    return await prisma.parkingSlot.findMany({
        orderBy: { label: 'asc' },
        include: { user: { select: { id: true, name: true } } }
    });
}
