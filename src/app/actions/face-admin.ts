"use server";

import axios from "axios";
import { prisma } from "@/lib/prisma";

async function getCompareFaceConfig() {
    const [urlSet, keySet] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "COMPAREFACE_URL" } }),
        prisma.setting.findUnique({ where: { key: "COMPAREFACE_KEY" } })
    ]);
    return {
        url: urlSet?.value || process.env.COMPARE_FACE_URL || "https://compareface.infratec.com.uy",
        apiKey: keySet?.value || "a0986800-8c5b-4583-9146-49281cf02e53"
    };
}

export async function testCompareFaceConnection() {
    try {
        const { url, apiKey } = await getCompareFaceConfig();
        const response = await axios.get(`${url}/api/v1/recognition/subjects`, {
            headers: { "x-api-key": apiKey },
            timeout: 5000
        });
        return { success: true, subjectsCount: response.data.subjects?.length || 0 };
    } catch (error: any) {
        console.error("CompareFace connection test failed:", error.message);
        return { success: false, error: error.message };
    }
}

export async function getCompareFaceSubjects() {
    try {
        const { url, apiKey } = await getCompareFaceConfig();
        const response = await axios.get(`${url}/api/v1/recognition/subjects`, {
            headers: { "x-api-key": apiKey },
            timeout: 10000
        });

        const subjects = response.data.subjects || [];

        // Enhance subjects with face counts if possible
        // Note: some versions of CompareFace don't provide this in the subject list
        return { success: true, subjects };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteCompareFaceSubject(subject: string) {
    try {
        const { url, apiKey } = await getCompareFaceConfig();
        await axios.delete(`${url}/api/v1/recognition/subjects/${encodeURIComponent(subject)}`, {
            headers: { "x-api-key": apiKey },
            timeout: 10000
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
