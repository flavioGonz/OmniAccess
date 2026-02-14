"use server";

import { prisma } from "@/lib/prisma";
import axios from "axios";
import FormData from "form-data";
import { getImagePath } from "@/lib/image-path";

const COMPARE_FACE_URL = process.env.COMPARE_FACE_URL || "https://compareface.infratec.com.uy";

const API_KEYS = {
    RECO: "a0986800-8c5b-4583-9146-49281cf02e53",
    DETECT: "3e92c632-8770-4d37-a615-18b0f7ea30bf",
    VERIFY: "60bfa16a-efb9-4c71-8dd2-4264e8965a96",
    VISITORS: "d7bdb468-26af-4306-b35d-499e5373ac4a"
};

export async function verifyFaceAction(eventSnapshot: string, userId?: string, nativeName?: string) {
    if (!eventSnapshot) {
        return { success: false, error: "Missing snapshot" };
    }

    try {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:10001").replace(/\/$/, "");
        const imagePath = eventSnapshot.startsWith('http') ? eventSnapshot : getImagePath(eventSnapshot);
        const imgUrl = imagePath?.startsWith('http') ? imagePath : `${appUrl}${imagePath}`;

        // Fetch threshold from DB - Using 0.9 as per user request (+90%)
        const simSetting = await prisma.setting.findUnique({ where: { key: "COMPAREFACE_MIN_SIM" } });
        const minSimilarity = parseFloat(simSetting?.value || "0.9");

        // Fetch image buffer once
        const imageResponse = await axios.get(imgUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imageResponse.data);

        const hasCameraData = nativeName && !['Desconocido', 'N/A', 'Unknown', 'Persona'].some(s => nativeName.includes(s));

        let topResult = null;
        let faceBox = null;
        let usedCollection = 'Main';

        const recognize = async (apiKey: string) => {
            const form = new FormData();
            form.append('file', buffer, { filename: 'snapshot.jpg', contentType: 'image/jpeg' });
            return axios.post(`${COMPARE_FACE_URL}/api/v1/recognition/recognize`, form, {
                headers: { ...form.getHeaders(), "x-api-key": apiKey },
                timeout: 4000
            });
        };

        // 1. Try Main
        try {
            const resMain = await recognize(API_KEYS.RECO);
            topResult = resMain.data.result?.[0]?.subjects?.[0];
            faceBox = resMain.data.result?.[0]?.box;
        } catch (err) {
            console.warn("[Neural Engine] Main RECO unreachable.");
        }

        // 2. Try Visitors if not in Main
        if (!topResult) {
            try {
                const resVis = await recognize(API_KEYS.VISITORS);
                topResult = resVis.data.result?.[0]?.subjects?.[0];
                if (topResult) {
                    faceBox = resVis.data.result?.[0]?.box;
                    usedCollection = 'Visitors';
                }
            } catch (err) {
                console.warn("[Neural Engine] Visitors RECO unreachable.");
            }
        }

        // 3. Roll unknown ID if still nothing and camera is blind
        if (!topResult && !hasCameraData) {
            const unknownId = `VISIT_${new Date().getTime()}`;
            try {
                await registerFaceInCompereFace(unknownId, buffer, API_KEYS.VISITORS);
                return {
                    success: true,
                    verified: false,
                    similarity: 0,
                    recognizedAs: unknownId,
                    cameraResult: nativeName,
                    collection: 'Visitors (Auto)'
                };
            } catch (err) {
                return { success: true, verified: false, recognizedAs: 'Desconocido', cameraResult: nativeName };
            }
        }

        const isVerified = hasCameraData;
        let dbUser = null;
        let finalSubject = topResult?.subject || (hasCameraData ? nativeName : null);

        // AUTO-TRAINING LOGIC: If we have a recognized subject, ensure they have up to 3 faces for training
        if (finalSubject) {
            try {
                const apiKey = usedCollection === 'Visitors' ? API_KEYS.VISITORS : API_KEYS.RECO;
                const faceCount = await getFaceCountForSubject(finalSubject, apiKey);

                if (faceCount < 3) {
                    console.log(`[Neural Training] Subject '${finalSubject}' has ${faceCount} faces. Adding new training sample...`);
                    await registerFaceInCompereFace(finalSubject, buffer, apiKey);
                }
            } catch (err) {
                console.warn("[Neural Training] Failed to check/add training face:", err);
            }
        }

        if (topResult && usedCollection === 'Main') {
            dbUser = await prisma.user.findFirst({
                where: { name: { equals: topResult.subject, mode: 'insensitive' } },
                include: { unit: true }
            });
        }

        return {
            success: true,
            verified: isVerified,
            similarity: topResult?.similarity || 0,
            recognizedAs: finalSubject || 'Sin Registro',
            cameraResult: nativeName,
            user: dbUser,
            box: faceBox,
            collection: usedCollection,
            lowConfidence: topResult ? topResult.similarity < minSimilarity : true
        };

    } catch (error: any) {
        console.error("Error in verifyFaceAction:", error.response?.data || error.message);
        return { success: false, error: "Service error", details: error.message };
    }
}

export async function searchByPhotoAction(photoData: Uint8Array | Buffer, useVisitors = false) {
    const photoBuffer = Buffer.from(photoData);
    console.log(`[Neural Search] Initializing analysis for image (${photoBuffer.length} bytes) using ${useVisitors ? 'Visitors' : 'Main'} collection`);
    try {
        const form = new FormData();
        form.append('file', photoBuffer, { filename: 'search.jpg', contentType: 'image/jpeg' });

        const apiKey = useVisitors ? API_KEYS.VISITORS : API_KEYS.RECO;
        console.log(`[Neural Search] Sending request to CompereFace: ${COMPARE_FACE_URL}/api/v1/recognition/recognize`);
        const response = await axios.post(`${COMPARE_FACE_URL}/api/v1/recognition/recognize`, form, {
            headers: {
                ...form.getHeaders(),
                "x-api-key": apiKey
            },
            timeout: 15000
        });

        const results = response.data.result || [];
        console.log(`[Neural Search] CompereFace response received. Detected faces: ${results.length}`);

        // Find the best match across all detected faces if any
        let bestMatch: any = null;
        for (const face of results) {
            if (face.subjects && face.subjects.length > 0) {
                const topSubject = face.subjects[0];
                if (!bestMatch || topSubject.similarity > bestMatch.similarity) {
                    bestMatch = topSubject;
                }
            }
        }

        if (bestMatch) {
            console.log(`[Neural Search] Top match: ${bestMatch.subject} (${(bestMatch.similarity * 100).toFixed(1)}%)`);
            // Find the user in our DB by name
            const user = await prisma.user.findFirst({
                where: { name: { equals: bestMatch.subject, mode: 'insensitive' } },
                include: { unit: true }
            });

            if (user) {
                console.log(`[Neural Search] Internal Mapping found: ${user.name} (ID: ${user.id})`);
            } else {
                console.log(`[Neural Search] No internal mapping for subject: ${bestMatch.subject}`);
            }

            return {
                success: true,
                match: bestMatch,
                user: user
            };
        }

        console.log(`[Neural Search] No matching subjects found in the provided image.`);
        return { success: true, match: null };

    } catch (error: any) {
        console.error("Error in searchByPhotoAction:", error.response?.data || error.message);
        return { success: false, error: "Search service error", details: error.message };
    }
}

/**
 * Registers a new face image for a specific subject in CompereFace
 */
export async function registerFaceInCompereFace(subjectName: string, photoBuffer: Buffer, apiKey?: string) {
    console.log(`[Neural Registration] Adding face for subject: ${subjectName}`);
    try {
        const form = new FormData();
        form.append('file', photoBuffer, { filename: 'subject.jpg', contentType: 'image/jpeg' });

        const url = `${COMPARE_FACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`;
        const response = await axios.post(url, form, {
            headers: {
                ...form.getHeaders(),
                "x-api-key": apiKey || API_KEYS.RECO
            },
            timeout: 10000
        });

        console.log(`[Neural Registration] Success:`, response.data);
        return { success: true, data: response.data };
    } catch (error: any) {
        console.error("[Neural Registration] Error:", error.response?.data || error.message);
        return { success: false, error: "Registration service error", details: error.response?.data || error.message };
    }
}

/**
 * Gets the number of faces registered for a subject in CompereFace
 */
export async function getFaceCountForSubject(subjectName: string, apiKey: string) {
    try {
        const response = await axios.get(`${COMPARE_FACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectName)}`, {
            headers: { "x-api-key": apiKey },
            timeout: 5000
        });
        return (response.data.faces || []).length;
    } catch (err) {
        console.warn(`[Neural Engine] Failed to get face count for '${subjectName}':`, err);
        return 999; // Assume plenty if error to avoid redundant calls
    }
}

/**
 * Detects faces in an image using Omniaccess Detect service
 */
export async function detectFaceAction(photoData: Uint8Array | Buffer) {
    const photoBuffer = Buffer.from(photoData);
    try {
        const form = new FormData();
        form.append('file', photoBuffer, { filename: 'detect.jpg', contentType: 'image/jpeg' });

        const response = await axios.post(`${COMPARE_FACE_URL}/api/v1/detection/detect`, form, {
            headers: {
                ...form.getHeaders(),
                "x-api-key": API_KEYS.DETECT
            },
            timeout: 10000
        });

        const results = response.data.result || [];
        return { success: true, faces: results };
    } catch (error: any) {
        console.error("Error in detectFaceAction:", error.response?.data || error.message);
        return { success: false, error: "Detection service error", details: error.message };
    }
}

/**
 * Verifies if two face images belong to the same person using Omniaccess Verify service
 */
export async function verifyIdentityAction(sourcePhoto: Buffer, targetPhoto: Buffer) {
    try {
        const form = new FormData();
        form.append('source_image', sourcePhoto, { filename: 'source.jpg', contentType: 'image/jpeg' });
        form.append('target_image', targetPhoto, { filename: 'target.jpg', contentType: 'image/jpeg' });

        const response = await axios.post(`${COMPARE_FACE_URL}/api/v1/verification/verify`, form, {
            headers: {
                ...form.getHeaders(),
                "x-api-key": API_KEYS.VERIFY
            },
            timeout: 15000
        });

        const result = response.data.result?.[0]; // Assuming array or single object
        if (result) {
            const similarity = result.similarity;
            // Threshold logic could be applied here or in frontend (e.g. > 0.8 is match)
            const isMatch = similarity > 0.8;
            return { success: true, verified: isMatch, similarity: similarity };
        }

        return { success: false, error: "No result from verification service" };

    } catch (error: any) {
        console.error("Error in verifyIdentityAction:", error.response?.data || error.message);
        return { success: false, error: "Verification service error", details: error.message };
    }
}
