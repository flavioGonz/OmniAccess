import { prisma } from "@/lib/prisma";
import { getSetting } from "@/app/actions/settings";
import axios from "axios";

export async function getWahaConfig() {
    const [url, apiKey] = await Promise.all([
        getSetting("WAHA_URL"),
        getSetting("WAHA_API_KEY")
    ]);
    return {
        url: url?.value || "http://localhost:3000",
        apiKey: apiKey?.value
    };
}

export async function sendWahaText(chatId: string, text: string) {
    try {
        const config = await getWahaConfig();
        const headers: any = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['X-Api-Key'] = config.apiKey;

        await axios.post(`${config.url}/api/sendText`, {
            chatId,
            text,
            session: "default"
        }, { headers });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to send WAHA text:", error.message);
        return { success: false, error: error.message };
    }
}

export async function sendWahaImage(chatId: string, image: { url?: string, base64?: string }, caption?: string) {
    try {
        const config = await getWahaConfig();
        const headers: any = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['X-Api-Key'] = config.apiKey;

        const body: any = {
            chatId,
            file: {
                mimetype: "image/jpeg",
                filename: "snapshot.jpg",
            },
            caption: caption,
            session: "default"
        };

        if (image.base64) {
            // Ensure base64 string doesn't include the data:image/xxx;base64, prefix if WAHA behaves standardly,
            // but usually libraries accept plain base64 data.
            // Check if it has prefix and strip it if needed, or pass full data uri.
            // WAHA documentation usually expects data URI or plain base64. Let's try passing the data URI format if available.
            body.file.data = image.base64;
        } else if (image.url) {
            body.file.url = image.url;
        }

        await axios.post(`${config.url}/api/sendImage`, body, { headers });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to send WAHA image:", error.message);
        return { success: false, error: error.message };
    }
}
