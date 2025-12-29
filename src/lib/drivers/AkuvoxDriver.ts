import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential, AuthType } from "@prisma/client";
import axios from "axios";
import * as https from "https";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

export class AkuvoxDriver implements IDeviceDriver {

    private async request(method: "GET" | "POST", path: string, data: any, device: Device, timeout: number = 30000): Promise<any> {
        const url = `${this.getBaseUrl(device)}${path}`;
        const headers: any = { 'Content-Type': 'application/json' };

        if (device.authType === 'BASIC') {
            Object.assign(headers, this.getAuthHeader(device));
        }

        try {
            const response = await axios.request({
                method,
                url,
                data,
                headers,
                httpsAgent,
                timeout
            });
            return response.data;
        } catch (error: any) {
            if (device.authType === 'DIGEST' && error.response?.status === 401) {
                const authHeader = error.response.headers["www-authenticate"];
                if (!authHeader) throw error;

                const getVal = (key: string) => {
                    const match = authHeader.match(new RegExp(`${key}="?([^",]+)"?`));
                    return match ? match[1] : null;
                };

                const realm = getVal("realm");
                const nonce = getVal("nonce");
                const qop = getVal("qop");
                const opaque = getVal("opaque");
                const algorithm = getVal("algorithm") || "MD5";

                const ha1 = crypto.createHash("md5").update(`${device.username}:${realm}:${device.password}`).digest("hex");
                const ha2 = crypto.createHash("md5").update(`${method}:${path}`).digest("hex");
                const nc = "00000001";
                const cnonce = crypto.randomBytes(8).toString("hex");

                let responseStr;
                if (qop) {
                    responseStr = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
                } else {
                    responseStr = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
                }

                const authString = `Digest username="${device.username}", realm="${realm}", nonce="${nonce}", uri="${path}", qop="${qop || ''}", nc=${nc}, cnonce="${cnonce}", response="${responseStr}", opaque="${opaque || ''}", algorithm="${algorithm}"`;

                const retryResponse = await axios.request({
                    method,
                    url,
                    data,
                    headers: { ...headers, Authorization: authString },
                    httpsAgent,
                    timeout
                });
                return retryResponse.data;
            }
            throw error;
        }
    }

    public getAuthHeader(device: Device) {
        if (!device.username || !device.password || device.authType === 'NONE') {
            return {};
        }
        const token = Buffer.from(`${device.username}:${device.password}`).toString('base64');
        return { Authorization: `Basic ${token}` };
    }

    public getBaseUrl(device: Device): string {
        return `http://${device.ip}`;
    }

    async getDeviceStats(device: Device) {
        try {
            // Usamos /api/user/get para obtener el total de identidades
            const [users, cards] = await Promise.all([
                this.request("POST", "/api/user/get",
                    { "target": "user", "action": "get", "data": { "offset": 0, "num": 1 } },
                    device,
                    15000 // Increased timeout for stats
                ),
                this.request("POST", "/api/rfkey/get",
                    { "target": "rfkey", "action": "get", "data": { "offset": 0, "num": 1 } },
                    device,
                    15000 // Increased timeout for stats
                )
            ]);

            return {
                faces: users?.data?.num || 0,
                tags: cards?.data?.num || 0
            };
        } catch (error) {
            console.error("[Akuvox] Error fetching stats:", error);
            return { faces: 0, tags: 0 };
        }
    }

    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        console.log(`[Akuvox] Syncing credential ${credential.value} to ${device.ip}`);

        if (credential.type === 'TAG') {
            await this.syncRfKey(credential, device);
        } else if (credential.type === 'FACE') {
            // Deprecated path, now using syncUserWithFace
            console.log(`[Akuvox] FACE credential sync is deprecated, use syncUserWithFace`);
        } else {
            console.log(`[Akuvox] Skipping credential type ${credential.type}`);
        }
    }

    // Generar un ID numérico determinista basado en el ID de la base de datos (string)
    private getNumericId(stringId: string): string {
        let hash = 0;
        for (let i = 0; i < stringId.length; i++) {
            const char = stringId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        // Retornamos un número positivo de 6 dígitos máximo para compatibilidad
        return Math.abs(hash % 1000000).toString();
    }

    async syncUserWithFace(user: any, device: Device) {
        console.log(`[Akuvox] Deterministic Sync User + Face: ${user.name} -> ${device.ip}`);

        const akuvoxId = this.getNumericId(user.id);

        // Extract Credentials
        const tags = user.credentials?.filter((c: any) => (c.type === 'TAG' || c.type === 'CARD') && c.value).map((c: any) => c.value) || [];
        const pinCred = user.credentials?.find((c: any) => c.type === 'PIN' && c.value);
        const pin = pinCred ? pinCred.value : undefined;

        try {
            // 1. Create User with basic info + credentials
            const userPayload: any = {
                "ID": akuvoxId,
                "Name": user.name,
                "UserCode": akuvoxId,
                "Type": "0",          // 0 = General User
                "Group": "Default",   // Default Group
                "Role": "-1",         // Standard Role
                "ScheduleRelay": "1001-1;1001-2;" // Access to Relay 1 and 2, Always (1001)
            };

            if (tags.length > 0) userPayload["CardCode"] = tags.join(',');
            if (pin) userPayload["PrivatePIN"] = pin;

            console.log(`[Akuvox] Sending User Payload (ID: ${akuvoxId}):`, JSON.stringify(userPayload));

            await this.request("POST", "/api/user/add", {
                "target": "user",
                "action": "add",
                "data": {
                    "item": [userPayload]
                }
            }, device);

        } catch (error: any) {
            console.error(`[Akuvox] Error adding user core data:`, error.message);
            throw new Error(`Error al crear usuario en el dispositivo: ${error.message}`);
        }

        // 2. Add Face (if exists)
        if (user.cara) {
            try {
                let imageBuffer: Buffer | null = null;

                if (user.cara.startsWith("/")) {
                    const localPath = path.join(process.cwd(), "public", user.cara);
                    if (fs.existsSync(localPath)) {
                        imageBuffer = fs.readFileSync(localPath);
                    }
                } else if (user.cara.startsWith("http")) {
                    const response = await axios.get(user.cara, { responseType: 'arraybuffer', timeout: 10000 });
                    imageBuffer = Buffer.from(response.data);
                }

                if (imageBuffer) {
                    const base64 = imageBuffer.toString('base64');
                    await this.request("POST", "/api/face/add", {
                        "target": "face",
                        "action": "add",
                        "data": {
                            "ID": akuvoxId,
                            "Image": base64
                        }
                    }, device);
                    console.log(`[Akuvox] Face image synced for ${user.name}`);
                }
            } catch (error: any) {
                console.warn(`[Akuvox] Warning: User created but Face Sync failed: ${error.message}`);
            }
        }
    }

    async syncRfKey(credential: Credential, device: Device) {
        const path = "/api/rfkey/add";
        const internalId = Math.floor(Math.random() * 100000).toString();

        const payload = {
            "target": "rfkey",
            "action": "add",
            "data": {
                "item": [
                    {
                        "ID": internalId,
                        "Code": credential.value,
                        "DoorNum": "1",
                        "Tags": "0",
                        "Mon": "1", "Tue": "1", "Wed": "1", "Thur": "1", "Fri": "1", "Sat": "1", "Sun": "1",
                        "TimeStart": "00:00",
                        "TimeEnd": "00:00"
                    }
                ]
            }
        };

        try {
            const response = await this.request("POST", path, payload, device);
            if (response && response.retcode === 0) {
                console.log(`[Akuvox] RFKey synced successfully: ${credential.value}`);
            } else {
                console.warn(`[Akuvox] RFKey sync failed: ${JSON.stringify(response)}`);
            }
        } catch (error: any) {
            console.error(`[Akuvox] Error calling RFKey API:`, error.message);
        }
    }

    async triggerRelay(device: Device): Promise<void> {
        try {
            // Updated Open Door commands based on user requirements
            // Using specific relay-only credentials: api / Api*2011
            const relayUser = "api";
            const relayPass = "Api*2011";
            const doorNum = "1"; // Default to Relay A

            // Method 1: Standard (No High Security)
            const path1 = `/fcgi/do?action=OpenDoor&UserName=${relayUser}&Password=${relayPass}&DoorNum=${doorNum}`;

            // Method 2: High Security (Basic Auth in URL)
            const highSecurityUrl = `http://${relayUser}:${relayPass}@${device.ip}/fcgi/OpenDoor?action=OpenDoor&DoorNum=${doorNum}`;

            console.log(`[Akuvox] Sending OpenDoor command to ${device.ip} (Relay ${doorNum})...`);

            try {
                // Try standard first
                const response = await this.request("GET", path1, null, device);
                console.log(`[Akuvox] OpenDoor response:`, response);
            } catch (error: any) {
                console.warn(`[Akuvox] Standard OpenDoor failed, trying High Security URL...`);
                // If it fails (e.g. 401), we might need the other format. 
                // Since this.request handles device credentials, but these are DIFFERENT relay credentials,
                // we'll use a direct fetch or modify request.
                const response = await fetch(highSecurityUrl).then(r => r.text());
                console.log(`[Akuvox] High Security OpenDoor response:`, response);
            }

        } catch (error: any) {
            console.error(`[Akuvox] Error triggering door on ${device.ip}:`, error.message);
            throw error;
        }
    }

    async syncAllFromDevice(device: Device): Promise<any[]> {
        console.log(`[Akuvox] Syncing all credentials from device ${device.ip}`);
        // This method will fetch all users (faces and tags) from the device
        // and return them in a unified format.
        return this.getFaceList(device); // getFaceList now handles both faces and tags via user module
    }

    async getFaceList(device: Device): Promise<any[]> {
        let users: any[] = [];
        let faceInternalIds: Set<string> = new Set();
        let faceUserIds: Set<string> = new Set();

        try {
            // 1. Get Users (with timeout)
            try {
                const data = await Promise.race([
                    this.request("POST", "/api/user/get",
                        { "target": "user", "action": "get", "data": { "offset": 0, "num": 200 } },
                        device
                    ),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting users')), 30000))
                ]);

                if (data && data.retcode === 0) {
                    users = data.data.item || [];
                    console.log(`[Akuvox] Retrieved ${users.length} users from device`);
                }
            } catch (error) {
                console.error(`[Akuvox] Error fetching users:`, error);
                throw new Error(`No se pudo conectar con el dispositivo. Verifica que esté encendido y accesible.`);
            }

            // 2. Get Face List (with timeout)
            try {
                const data = await Promise.race([
                    this.request("POST", "/api/face/list",
                        { "target": "face", "action": "list", "data": { "offset": 0, "num": 200 } },
                        device
                    ),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting faces')), 30000))
                ]);

                if (data && data.retcode === 0) {
                    const items = data.data.item || [];
                    items.forEach((f: any) => {
                        if (f.ID) faceInternalIds.add(String(f.ID).trim());
                        if (f.UserID) faceUserIds.add(String(f.UserID).trim());
                    });
                    console.log(`[Akuvox] Retrieved ${items.length} faces from device`);
                }
            } catch (error) {
                console.error(`[Akuvox] Error fetching face list:`, error);
                // Continue anyway with user list
            }

            // 3. Merge safely
            return users.map((u: any, index: number) => {
                const uID = String(u.ID || "").trim();
                const uUserID = String(u.UserID || "").trim();
                const uFaceNum = parseInt(u.FaceNum || "0");

                const hasFace =
                    faceInternalIds.has(uID) ||
                    faceUserIds.has(uUserID) ||
                    uFaceNum > 0 ||
                    (u.FaceUrl && u.FaceUrl.length > 5);

                const faceUrl = hasFace
                    ? `/api/proxy/device-image?deviceId=${device.id}&userId=${u.ID}&altId=${u.UserID || ''}&path=${encodeURIComponent(u.FaceUrl || '')}`
                    : "";

                return {
                    Index: index + 1,
                    ID: u.ID,
                    Name: u.Name,
                    UserID: u.UserID,
                    UserCode: u.UserCode || "", // Capture specific UserCode from device
                    HasFace: hasFace,
                    FaceUrl: faceUrl,
                    CardCode: u.CardCode || "",
                    HasTag: u.CardCode && u.CardCode !== "",
                    PIN: u.Password || ""
                };
            });
        } catch (error) {
            console.error(`[Akuvox] Error in getFaceList:`, error);
            throw error;
        }
    }

    async getFaceImage(device: Device, userId: string, altId?: string, specificPath?: string): Promise<Buffer | null> {
        try {
            // 0. Try specific path if provided (e.g. from FaceUrl field)
            if (specificPath && specificPath.length > 2 && specificPath !== "undefined" && specificPath !== "null") {
                let url = specificPath;
                if (!url.startsWith("http")) {
                    if (!url.startsWith("/")) url = "/" + url;
                    url = `${this.getBaseUrl(device)}${url}`;
                }
                console.log(`[Akuvox] Trying specific path: ${url}`);
                try {
                    const response = await axios.get(url, {
                        responseType: 'arraybuffer',
                        headers: this.getAuthHeader(device),
                        httpsAgent,
                        timeout: 15000,
                        validateStatus: () => true
                    });
                    if (response.status === 200) {
                        // Relaxed check: if it returns 200 and has bytes, assume image
                        return Buffer.from(response.data);
                    }
                } catch (e) {
                    console.warn(`[Akuvox] Specific path failed. Falling back to ID search.`);
                }
            }

            // Combinamos todos los IDs posibles para probar
            const idsToTry = [userId];
            if (altId && altId !== userId) idsToTry.push(altId);

            // Parámetros de URL comunes en diferentes firmwares
            const paramNames = ["id", "FaceId", "UserID"];

            for (const idValue of idsToTry) {
                for (const paramName of paramNames) {
                    const url = `${this.getBaseUrl(device)}/api/face/get?${paramName}=${idValue}`;
                    console.log(`[Akuvox] Attempting to fetch face image with: ${url}`);

                    const response = await axios.get(url, {
                        responseType: 'arraybuffer',
                        headers: this.getAuthHeader(device),
                        httpsAgent: httpsAgent,
                        timeout: 10000,
                        validateStatus: () => true
                    });

                    if (response.status === 401 && device.authType === 'DIGEST') {
                        // Lógica de Digest (simplificada para reintento)
                        const retryBuffer = await this.getFaceImageDigest(url, device);
                        if (retryBuffer) return retryBuffer;
                    }

                    if (response.status === 200) {
                        const contentType = response.headers['content-type'] || "";

                        // Si es una imagen directa, devolvemos el buffer
                        if (contentType.includes("image/")) {
                            return Buffer.from(response.data);
                        }

                        // Si es un JSON (algunos firmwares devuelven {Image: "base64"}), lo parseamos
                        try {
                            const str = Buffer.from(response.data).toString('utf8');
                            if (str.trim().startsWith("{")) {
                                const json = JSON.parse(str);
                                const base64 = json.data?.Image || json.Image || json.data?.item?.[0]?.Image;
                                if (base64) {
                                    return Buffer.from(base64, 'base64');
                                }
                            }
                        } catch (e) { /* No era JSON válido o no tenía imagen */ }
                    }
                }
            }
        } catch (error) {
            console.error(`[Akuvox] Error final getting face image:`, error);
        }
        return null;
    }

    private async getFaceImageDigest(url: string, device: Device): Promise<Buffer | null> {
        // Obtenemos el header WWW-Authenticate
        try {
            const firstResponse = await axios.get(url, { httpsAgent, validateStatus: () => true });
            const authHeader = firstResponse.headers['www-authenticate'];
            if (!authHeader) return null;

            const getVal = (key: string) => {
                const match = authHeader.match(new RegExp(`${key}="?([^",]+)"?`));
                return match ? match[1] : null;
            };

            const realm = getVal("realm");
            const nonce = getVal("nonce");
            const qop = getVal("qop");
            const opaque = getVal("opaque");
            const algorithm = getVal("algorithm") || "MD5";

            const path = new URL(url).pathname + new URL(url).search;
            const method = "GET";

            const ha1 = crypto.createHash("md5").update(`${device.username}:${realm}:${device.password}`).digest("hex");
            const ha2 = crypto.createHash("md5").update(`${method}:${path}`).digest("hex");
            const nc = "00000001";
            const cnonce = crypto.randomBytes(8).toString("hex");

            let responseStr;
            if (qop) {
                responseStr = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
            } else {
                responseStr = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
            }

            const authString = `Digest username="${device.username}", realm="${realm}", nonce="${nonce}", uri="${path}", qop="${qop || ''}", nc=${nc}, cnonce="${cnonce}", response="${responseStr}", opaque="${opaque || ''}", algorithm="${algorithm}"`;

            const retryResponse = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: { Authorization: authString },
                httpsAgent,
                timeout: 10000
            });

            if (retryResponse.status === 200) {
                const contentType = retryResponse.headers['content-type'] || "";
                if (contentType.includes("image/")) {
                    return Buffer.from(retryResponse.data);
                }
                const str = Buffer.from(retryResponse.data).toString('utf8');
                if (str.trim().startsWith("{")) {
                    const json = JSON.parse(str);
                    const base64 = json.data?.Image || json.Image;
                    if (base64) return Buffer.from(base64, 'base64');
                }
            }
        } catch (e) {
            console.error("[Akuvox] Digest retry failed", e);
        }
        return null;
    }



    async deleteFace(device: Device, faceId: string, userId?: string, userCode?: string): Promise<boolean> {
        console.log(`[Akuvox] Deleting face ID:${faceId} UserID:${userId} Code:${userCode} from ${device.ip}`);

        const tryAction = async (data: any, strategyName: string) => {
            // Try standard "delete"
            try {
                const res = await this.request("POST", "/api/user/delete", {
                    "target": "user", "action": "delete", "data": data
                }, device);
                if (res && res.retcode === 0) return true;

                // If unsupport action, try "del"
                if (res && (res.message?.includes("unsupport") || res.retcode === -1)) {
                    console.log(`[Akuvox] 'delete' unsupported, trying 'del' for ${strategyName}...`);
                    const resDel = await this.request("POST", "/api/user/delete", {
                        "target": "user", "action": "del", "data": data
                    }, device);
                    if (resDel && resDel.retcode === 0) return true;

                    // Try "remove"
                    console.log(`[Akuvox] 'del' unsupported, trying 'remove' for ${strategyName}...`);
                    const resRemove = await this.request("POST", "/api/user/delete", {
                        "target": "user", "action": "remove", "data": data
                    }, device);
                    if (resRemove && resRemove.retcode === 0) return true;
                }
            } catch (e: any) {
                console.warn(`[Akuvox] ${strategyName} failed:`, e.message);
            }
            return false;
        };

        const tryLegacyCGI = async (urlParams: string) => {
            const url = `${this.getBaseUrl(device)}/fcgi/do?action=DeleteUser&${urlParams}`;
            try {
                console.log(`[Akuvox] Trying Legacy CGI: ${url}`);
                const response = await axios.get(url, {
                    headers: this.getAuthHeader(device),
                    httpsAgent,
                    timeout: 5000,
                    validateStatus: () => true
                });
                if (response.status === 200 && (response.data?.includes("success") || response.data?.retcode === 0)) {
                    console.log(`[Akuvox] CGI Success`);
                    return true;
                }
            } catch (e: any) {
                console.warn(`[Akuvox] CGI failed:`, e.message);
            }
            return false;
        };

        // Strategy 1: Delete by Internal ID (Array)
        if (await tryAction({ "ID": [String(faceId)] }, "Strategy 1 (ID)")) return true;

        // Strategy 2: Delete by Internal ID (String)
        if (await tryAction({ "ID": String(faceId) }, "Strategy 2 (ID String)")) return true;

        // Strategy 3: Delete by UserID
        if (userId && userId !== "undefined") {
            if (await tryAction({ "UserID": [String(userId)] }, "Strategy 3 (UserID)")) return true;
        }

        // Strategy 4: Delete by UserCode
        const codeToTry = userCode || userId;
        if (codeToTry && codeToTry !== "undefined") {
            if (await tryAction({ "UserCode": [String(codeToTry)] }, "Strategy 4 (UserCode)")) return true;
        }

        // Strategy 5: Legacy CGI - UserID
        if (userId && await tryLegacyCGI(`UserID=${userId}`)) return true;

        // Strategy 6: Legacy CGI - ID
        if (await tryLegacyCGI(`ID=${faceId}`)) return true;

        console.error(`[Akuvox] All delete strategies failed for ${faceId}/${userId}`);
        return false;
    }
}
