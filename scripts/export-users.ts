
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function exportUsers() {
    try {
        console.log("Connecting to database...");
        const users = await prisma.user.findMany({
            include: {
                accessGroups: true,
                credentials: true,
                vehicles: true,
            }
        });

        console.log(`Found ${users.length} users.`);

        const exportPath = path.join(process.cwd(), 'users_export.json');

        // Remove sensitive or unnecessary data if needed (like IDs if we want them regenerated, but keeping IDs is strictly better for references if tables serve same purpose, IF IDs are uuid. If IDs are auto-increment int, we should remove them or handle with care. Prisma schema uses String @id @default(cuid()) or uuid usually. Let's check schema).
        // Checking user schema previously: model User { id String @id @default(cuid()) ... }
        // So we can keep IDs to preserve references if we want, OR better, let new IDs be generated and match by email/dni to avoid conflicts if prod already has data.
        // For a full migration to empty DB, keeping IDs is fine. For merging, remove IDs.
        // Let's assume merging strategy: Match by EMAIL or DNI. If exists, update or skip. If not, create.

        const data = JSON.stringify(users, null, 2);
        fs.writeFileSync(exportPath, data);

        console.log(`Exported users to ${exportPath}`);
    } catch (e) {
        console.error("Error exporting users:", e);
    } finally {
        await prisma.$disconnect();
    }
}

exportUsers();
