import { prisma } from "../src/lib/prisma";
import axios from "axios";

const VISITORS_API_KEY = "d7bdb468-26af-4306-b35d-499e5373ac4a";
const COMPEREFACE_URL = "https://compareface.infratec.com.uy";

async function clearVisitors() {
    console.log("--- STARTING VISITORS CLEARANCE ---");

    try {
        // 1. Clear CompreFace Subjects
        console.log("[CompreFace] Fetching subjects...");
        const subjectsRes = await axios.get(`${COMPEREFACE_URL}/api/v1/recognition/subjects`, {
            headers: { "x-api-key": VISITORS_API_KEY }
        });

        const subjects = subjectsRes.data.subjects || [];
        console.log(`[CompreFace] Found ${subjects.length} subjects.`);

        for (const subject of subjects) {
            console.log(`[CompreFace] Deleting subject: ${subject}`);
            await axios.delete(`${COMPEREFACE_URL}/api/v1/recognition/subjects/${subject}`, {
                headers: { "x-api-key": VISITORS_API_KEY }
            });
        }
        console.log("[CompreFace] Visitors collection cleared.");

        // 2. Clear Database Visitors
        console.log("[DB] Finding visitors...");
        const visitorUsers = await prisma.user.findMany({
            where: {
                role: { in: ["VISITOR", "TEMPORARY_VISITOR"] }
            },
            select: { id: true, name: true }
        });

        console.log(`[DB] Found ${visitorUsers.length} visitors to delete.`);

        for (const visitor of visitorUsers) {
            console.log(`[DB] Deleting visitor: ${visitor.name} (${visitor.id})`);

            // Delete related records first if necessary, though Cascade might handle some
            // AccessEvent.userId is related, Credential.userId is related

            await prisma.credential.deleteMany({ where: { userId: visitor.id } });
            // We don't delete AccessEvents because they are history, but we should nullify the userId or delete them if preferred
            // The user wants to "restart to 0", so maybe they want the history gone too?
            // Usually "restart visitors" means the profiles.

            await prisma.user.delete({ where: { id: visitor.id } });
        }

        console.log("--- VISITORS CLEARANCE COMPLETE ---");
    } catch (error: any) {
        console.error("Error during clearance:", error.response?.data || error.message);
    }
}

clearVisitors();
