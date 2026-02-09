import { prisma } from "@/lib/prisma";
import GuardConsole from "./GuardConsole";

export const dynamic = "force-dynamic";

export default async function GuardPage() {
    const initialEntries = await prisma.bitacora.findMany({
        take: 500,
        orderBy: { timestamp: "desc" },
        include: {
            accessEvent: true
        }
    });

    const [logoSetting, headerColorSetting, iconsSetting, globalLogoSetting] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "GUARD_MAIN_LOGO" } }),
        prisma.setting.findUnique({ where: { key: "GUARD_TABLE_HEADER_COLOR" } }),
        prisma.setting.findUnique({ where: { key: "GUARD_APP_ICONS" } }),
        prisma.setting.findUnique({ where: { key: "COMPANY_LOGO" } }),
    ]);

    // Fetch units for selection
    const units = await prisma.unit.findMany({
        orderBy: { name: "asc" },
        include: {
            users: {
                include: {
                    vehicles: true
                }
            }
        }
    });

    return (
        <GuardConsole
            initialEntries={initialEntries}
            logo={logoSetting?.value || globalLogoSetting?.value || "/logo-transparent.png"}
            headerColor={headerColorSetting?.value || "#000000"}
            initialIcons={iconsSetting?.value ? JSON.parse(iconsSetting.value) : {}}
            units={units}
        />
    );
}
