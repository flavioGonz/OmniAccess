import { prisma } from "@/lib/prisma";
import GuardConsole from "./GuardConsole";

export const dynamic = "force-dynamic";

export default async function GuardPage() {
    const initialEntries = await prisma.bitacora.findMany({
        take: 20,
        orderBy: { timestamp: "desc" },
        include: {
            accessEvent: true
        }
    });

    const logoSetting = await prisma.setting.findUnique({ where: { key: "COMPANY_LOGO" } });

    // Fetch units for selection
    const units = await prisma.unit.findMany({
        select: { id: true, name: true, number: true },
        orderBy: { name: "asc" }
    });

    return (
        <GuardConsole
            initialEntries={initialEntries}
            logo={logoSetting?.value || "/logo-sildan.png"}
            units={units}
        />
    );
}
