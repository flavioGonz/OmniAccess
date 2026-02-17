"use server";

import { prisma } from "@/lib/prisma";
import axios from "axios";
import FormData from "form-data";
import { getImagePath } from "@/lib/image-path";
import { getSetting } from "@/app/actions/settings";
import { revalidatePath } from "next/cache";

const COMPARE_FACE_URL = process.env.COMPARE_FACE_URL || "https://compareface.infratec.com.uy";

const API_KEYS = {
    RECO: "a0986800-8c5b-4583-9146-49281cf02e53",
    DETECT: "3e92c632-8770-4d37-a615-18b0f7ea30bf",
    VERIFY: "60bfa16a-efb9-4c71-8dd2-4264e8965a96",
    VISITORS: "d7bdb468-26af-4306-b35d-499e5373ac4a"
};

/**
 * Main Face Verification Protocol (Neural AI v3 - SERIOUS LOGIC)
 * Now supports direct buffer for 0-latency server-side processing.
 */
export async function verifyFaceAction(
    eventSnapshot: string,
    userId?: string,
    nativeName?: string,
    providedBuffer?: Buffer
) {
    if (!eventSnapshot && !providedBuffer) {
        return { success: false, error: "Missing data" };
    }

    const start = Date.now();
    console.log(`[Neural AI] Starting analysis for: ${nativeName || eventSnapshot}`);

    try {
        // 1. DATA PREPARATION
        let buffer = providedBuffer;
        if (!buffer) {
            const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:10001").replace(/\/$/, "");
            const imagePath = eventSnapshot.startsWith('http') ? eventSnapshot : getImagePath(eventSnapshot);
            const imgUrl = imagePath?.startsWith('http') ? imagePath : `${appUrl}${imagePath}`;
            const imageResponse = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 5000 });
            buffer = Buffer.from(imageResponse.data);
        }

        // 2. CONFIGURATION & THRESHOLDS
        const thresholdSetting = await getSetting("COMPAREFACE_MIN_SIM");
        const SUCCESS_THRESHOLD = parseFloat(thresholdSetting?.value || "0.90");
        const VISITOR_LINK_THRESHOLD = 0.65; // Don't duplicate if match > 65% in visitors
        const NEW_VISITOR_THRESHOLD = 0.40;  // Only register as "New" if match < 40%

        // Helper for recognizing
        const recognize = (apiKey: string) => {
            const form = new FormData();
            form.append('file', buffer, { filename: 'snapshot.jpg', contentType: 'image/jpeg' });
            return axios.post(`${COMPARE_FACE_URL}/api/v1/recognition/recognize?limit=3`, form, {
                headers: { ...form.getHeaders(), "x-api-key": apiKey },
                timeout: 8000
            });
        };

        // 3. PARALLEL NEURAL SEARCH (Speed improvement)
        console.log(`[Neural AI] Dispatching parallel searches (Main & Visitors)...`);
        const searchResults = await Promise.allSettled([
            recognize(API_KEYS.RECO),
            recognize(API_KEYS.VISITORS)
        ]);

        const resMain = searchResults[0].status === 'fulfilled' ? searchResults[0].value : null;
        const resVisitors = searchResults[1].status === 'fulfilled' ? searchResults[1].value : null;

        const topMain = resMain?.data?.result?.[0]?.subjects?.[0];
        const topVisitors = resVisitors?.data?.result?.[0]?.subjects?.[0];
        const faceBox = resMain?.data?.result?.[0]?.box || resVisitors?.data?.result?.[0]?.box;

        const mainSim = topMain?.similarity || 0;
        const visitorSim = topVisitors?.similarity || 0;

        // 4. IDENTITY DETERMINATION (Serious Logic Fix)
        let finalSubject = null;
        let usedCollection = 'Main';
        let isNewVisitor = false;

        // Priority 1: High Confidence Resident Match
        if (mainSim >= SUCCESS_THRESHOLD) {
            finalSubject = topMain.subject;
            usedCollection = 'Main';
        }
        // Priority 2: High/Mid Confidence Visitor Match (PREVENTS DUPLICATES)
        else if (visitorSim >= VISITOR_LINK_THRESHOLD) {
            finalSubject = topVisitors.subject;
            usedCollection = 'Visitors';
            console.log(`[Neural AI] Linked to existing visitor '${finalSubject}' (Match: ${(visitorSim * 100).toFixed(1)}%)`);
        }
        // Priority 3: Hardware trust if camera is very sure and neural doesn't strongly object
        else {
            const cameraNameMatch = nativeName || eventSnapshot.match(/Persona: ([^,]+)/)?.[1];
            const cameraConfidenceMatch = eventSnapshot.match(/Confianza: (\d+)%/);
            const nativeConfidence = cameraConfidenceMatch ? parseInt(cameraConfidenceMatch[1]) : 0;
            const hasGoodCameraData = cameraNameMatch && !['Desconocido', 'N/A', 'Persona'].some(s => cameraNameMatch.includes(s)) && nativeConfidence >= 90;

            if (hasGoodCameraData) {
                finalSubject = cameraNameMatch;
            } else if (visitorSim < NEW_VISITOR_THRESHOLD && mainSim < NEW_VISITOR_THRESHOLD) {
                // High probability of being a NEW person
                isNewVisitor = true;
            }
        }

        const maxSimilarity = Math.max(mainSim, visitorSim);

        // 5. AUTO-REGISTRATION OF GENUINE NEW VISITORS
        let dbUser = null;
        if (isNewVisitor && !finalSubject) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '');
            const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(/:/g, '');
            const rand = Math.floor(100 + Math.random() * 899);
            const unknownId = `visita_${dateStr}_${timeStr}_${rand}`;

            console.log(`[Neural AI] NO identity confirmed. Registering strictly NEW visitor: ${unknownId}`);
            try {
                const regResult = await registerFaceInCompereFace(unknownId, buffer!, API_KEYS.VISITORS);
                if (regResult.success) {
                    dbUser = await prisma.user.create({
                        data: {
                            name: unknownId,
                            role: 'VISITOR',
                            observations: `Auto-registrado (${(maxSimilarity * 100).toFixed(1)}% match)`,
                            createdBy: 'Neural Engine'
                        }
                    });
                    finalSubject = unknownId;
                    usedCollection = 'Visitors';
                }
            } catch (regErr) {
                console.warn("[Neural AI] registration failed", regErr);
            }
        }

        // Find user in DB if identified
        if (finalSubject && !dbUser) {
            dbUser = await prisma.user.findFirst({
                where: { name: { equals: finalSubject, mode: 'insensitive' } },
                include: { unit: true }
            });
        }

        // 6. NEURAL SYNC (Learning Cycle - Improves future matches)
        if (finalSubject && dbUser && maxSimilarity >= 0.70) {
            // Training task: Add this new angle to their profile if they have few photos
            registerFaceInCompereFace(finalSubject, buffer!, dbUser.role === 'VISITOR' ? API_KEYS.VISITORS : API_KEYS.RECO)
                .catch(() => { }); // Non-blocking async train
        }

        // 7. PERSISTENCE & RESULTS
        const isVerified = (maxSimilarity >= SUCCESS_THRESHOLD) || (finalSubject && !isNewVisitor);
        const alertTriggered = dbUser?.role === 'BLACKLISTED' && isVerified;

        // Update the event in DB to avoid latency for the dashboard
        if (finalSubject && eventSnapshot) {
            try {
                const eventToUpdate = await prisma.accessEvent.findFirst({
                    where: { snapshotPath: eventSnapshot },
                    orderBy: { timestamp: 'desc' }
                });
                if (eventToUpdate) {
                    await prisma.accessEvent.update({
                        where: { id: eventToUpdate.id },
                        data: {
                            userId: dbUser?.id || eventToUpdate.userId,
                            details: eventToUpdate.details + ` | Neural ID: ${finalSubject} (${(maxSimilarity * 100).toFixed(1)}%)`
                        }
                    });
                }
            } catch (dbErr) { console.warn("[Neural AI] DB update delay", dbErr); }
        }

        console.log(`[Neural AI] Finished in ${Date.now() - start}ms. ID: ${finalSubject || 'Unidentified'}`);

        revalidatePath("/admin/dashboard-face");
        revalidatePath("/admin/history");

        return {
            success: true,
            verified: isVerified,
            similarity: maxSimilarity,
            recognizedAs: finalSubject || 'Desconocido',
            user: dbUser,
            box: faceBox,
            collection: usedCollection,
            lowConfidence: maxSimilarity < SUCCESS_THRESHOLD,
            alertTriggered: !!alertTriggered,
            duration: Date.now() - start
        };

    } catch (error: any) {
        console.error("Critical error in verifyFaceAction:", error.message);
        return { success: false, error: "System failure", details: error.message };
    }
}

export async function searchByPhotoAction(photoData: Uint8Array | Buffer) {
    const photoBuffer = Buffer.from(photoData);
    const start = Date.now();

    try {
        console.log(`[Guard Search] Starting parallel biometric search...`);

        const search = async (apiKey: string) => {
            const form = new FormData();
            form.append('file', photoBuffer, { filename: 'search.jpg', contentType: 'image/jpeg' });
            return axios.post(`${COMPARE_FACE_URL}/api/v1/recognition/recognize`, form, {
                headers: { ...form.getHeaders(), "x-api-key": apiKey },
                timeout: 8000 // Faster timeout for guard live feedback
            });
        };

        const results = await Promise.allSettled([
            search(API_KEYS.RECO),
            search(API_KEYS.VISITORS)
        ]);

        let bestMatch: any = null;
        let usedCollection = 'None';

        results.forEach((res, idx) => {
            if (res.status === 'fulfilled' && res.value.data.result) {
                const faces = res.value.data.result;
                for (const face of faces) {
                    if (face.subjects && face.subjects.length > 0) {
                        const top = face.subjects[0];
                        if (!bestMatch || top.similarity > bestMatch.similarity) {
                            bestMatch = top;
                            usedCollection = idx === 0 ? 'Residents' : 'Visitors';
                        }
                    }
                }
            }
        });

        if (!bestMatch) {
            return { success: true, match: null, user: null, duration: Date.now() - start };
        }

        const user = await prisma.user.findFirst({
            where: { name: { equals: bestMatch.subject, mode: 'insensitive' } },
            include: { unit: true }
        });

        return {
            success: true,
            match: bestMatch,
            user: user,
            collection: usedCollection,
            duration: Date.now() - start
        };
    } catch (error: any) {
        console.error("[Guard Search] Error:", error.response?.data || error.message);
        return { success: false, error: error.message || "Motor biometría no disponible" };
    }
}


export async function registerFaceInCompereFace(subjectName: string, photoBuffer: Buffer, apiKey?: string) {
    try {
        const actualKey = apiKey || API_KEYS.RECO;

        // Limit check: Don't over-train if profile already robust
        const countRes = await axios.get(`${COMPARE_FACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`, {
            headers: { "x-api-key": actualKey }, timeout: 5000
        }).catch(() => ({ data: { faces: new Array(100) } })); // If error, assume full

        if ((countRes.data.faces || []).length >= 15) {
            return { success: true, message: "Profile already robust" };
        }

        const form = new FormData();
        form.append('file', photoBuffer, { filename: 'subject.jpg', contentType: 'image/jpeg' });
        const url = `${COMPARE_FACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`;
        const response = await axios.post(url, form, {
            headers: { ...form.getHeaders(), "x-api-key": actualKey },
            timeout: 10000
        });
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, error: "Registration service error" };
    }
}

export async function detectFaceAction(photoData: Uint8Array | Buffer) {
    const photoBuffer = Buffer.from(photoData);
    try {
        const form = new FormData();
        form.append('file', photoBuffer, { filename: 'detect.jpg', contentType: 'image/jpeg' });
        const response = await axios.post(`${COMPARE_FACE_URL}/api/v1/detection/detect`, form, {
            headers: { ...form.getHeaders(), "x-api-key": API_KEYS.DETECT },
            timeout: 10000
        });
        return { success: true, faces: response.data.result || [] };
    } catch (error: any) {
        return { success: false, error: "Detection service error" };
    }
}

export async function verifyIdentityAction(sourcePhoto: Buffer, targetPhoto: Buffer) {
    try {
        const form = new FormData();
        form.append('source_image', sourcePhoto, { filename: 'source.jpg', contentType: 'image/jpeg' });
        form.append('target_image', targetPhoto, { filename: 'target.jpg', contentType: 'image/jpeg' });
        const response = await axios.post(`${COMPARE_FACE_URL}/api/v1/verification/verify`, form, {
            headers: { ...form.getHeaders(), "x-api-key": API_KEYS.VERIFY },
            timeout: 15000
        });
        const result = response.data.result?.[0];
        return { success: true, verified: (result?.similarity || 0) > 0.8, similarity: result?.similarity || 0 };
    } catch (error: any) {
        return { success: false, error: "Verification service error" };
    }
}

export async function purgeSubjectFacesAction(subjectName: string, useVisitors = false) {
    try {
        const apiKey = useVisitors ? API_KEYS.VISITORS : API_KEYS.RECO;
        await axios.delete(`${COMPARE_FACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`, {
            headers: { "x-api-key": apiKey }, timeout: 10000
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Cleanup service error" };
    }
}
