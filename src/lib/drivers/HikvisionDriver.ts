import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import crypto from "crypto";
import { IDeviceDriver } from "./IDeviceDriver";
import { Device, Credential, CredentialType, AuthType } from "@prisma/client";
import * as https from "https";

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

export class HikvisionDriver implements IDeviceDriver {
    // Simple Digest Auth Implementation
    private async request(
        method: "GET" | "POST" | "PUT" | "DELETE",
        url: string,
        data: any,
        device: Device
    ): Promise<any> {
        const username = device.username || "admin";
        const password = device.password || "12345";

        // Ensure IP doesn't already have a protocol to avoid double http://
        const host = (device.ip || "").replace(/^https?:\/\//, "");
        const baseURL = `http://${host}`;
        const headers: any = { "Content-Type": "application/json" };

        if (device.authType === AuthType.BASIC) {
            const token = Buffer.from(`${username}:${password}`).toString("base64");
            headers["Authorization"] = `Basic ${token}`;
        }

        try {
            // 1. Attempt
            const response = await axios.request({
                method,
                baseURL,
                url,
                data,
                headers: {
                    ...headers,
                    "Accept": "application/json"
                },
                httpsAgent,
                timeout: 10000,
            });
            console.log(`[Hikvision JSON] ${method} ${url} -> Status ${response.status}`);
            return response.data;
        } catch (error: any) {
            const authHeader = error.response?.headers["www-authenticate"];
            if (device.authType === AuthType.DIGEST && error.response?.status === 401 && authHeader) {
                // Parse WWW-Authenticate header
                const getVal = (key: string) => {
                    const match = authHeader.match(new RegExp(`${key}="?([^",]+)"?`));
                    return match ? match[1].trim() : null;
                };

                const realm = getVal("realm");
                const nonce = getVal("nonce");
                const qop = getVal("qop");
                const opaque = getVal("opaque");
                const algorithm = getVal("algorithm") || "MD5";

                if (!realm || !nonce) throw error; // Re-throw if it wasn't a valid digest challenge

                // Calculate Response
                const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
                const ha2 = crypto.createHash("md5").update(`${method}:${url}`).digest("hex");

                const nc = "00000001";
                const cnonce = crypto.randomBytes(8).toString("hex");
                let response = "";

                if (qop === "auth") {
                    response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
                } else {
                    response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
                }

                let authString = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${url}", algorithm="${algorithm}", response="${response}"`;
                if (opaque) authString += `, opaque="${opaque}"`;
                if (qop) authString += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

                // 2. Retry with Auth Header
                const res = await axios.request({
                    method,
                    baseURL,
                    url,
                    data,
                    headers: {
                        Authorization: authString,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    httpsAgent,
                    timeout: 20000,
                });
                return res.data;
            }
            throw error;
        }
    }

    async upsertCredential(credential: Credential, device: Device): Promise<void> {
        if (credential.type === CredentialType.PLATE) {
            try {
                process.stdout.write(`Syncing plate ${credential.value} to ${device.ip}... `);
                await this.addPlateToCamera(device, credential.value);
                process.stdout.write("DONE\n");
            } catch (e: any) {
                console.error(`FAILED: ${e.message}`);
            }
        }
    }

    async deleteCredential(credentialValue: string, device: Device): Promise<void> {
        // DELETE via Audit API (more robust for newer firmwares)
        const url = `/ISAPI/Traffic/channels/1/DelLicensePlateAuditData?format=json`;
        const payload = {
            id: [credentialValue], // Trying by plate directly
            deleteAllEnabled: false
        };

        try {
            console.log(`[Hikvision LPR] Deleting plate ${credentialValue} from ${device.ip}`);
            await this.request("PUT", url, payload, device);
        } catch (e: any) {
            console.error(`[Hikvision LPR] Failed to delete plate from ${device.ip}:`, e.message);
            // Fallback to direct DELETE method if PUT fails
            try {
                await this.request("DELETE", `/ISAPI/Traffic/channels/1/licensePlateDatabases/1/plates/${credentialValue}?format=json`, {}, device);
            } catch (err) {
                console.error(`[Hikvision LPR] Fallback delete also failed.`);
            }
        }
    }

    async getPlatesFromCamera(device: Device): Promise<string[]> {
        const searchId = Date.now().toString(16).slice(-8) + Math.random().toString(16).slice(2, 6);
        return this.getPlatesExhaustive(device, searchId);
    }

    /**
     * Internal exhaustive fetch (legacy/background)
     */
    private async getPlatesExhaustive(device: Device, searchId: string): Promise<string[]> {
        const page_size = 400;
        let start_position = 0;
        let all_plates: string[] = [];
        let keep_fetching = true;
        let total_matches = 0;

        console.log(`[Hikvision LPR] Starting exhaustive fetch for ${device.ip} with searchId: ${searchId}`);

        while (keep_fetching) {
            const url = `/ISAPI/Traffic/channels/1/searchLPListAudit`;
            const xml_data = `<?xml version="1.0" encoding="UTF-8"?><LPSearchCond><searchID>${searchId}</searchID><maxResult>${page_size}</maxResult><searchResultPosition>${start_position}</searchResultPosition></LPSearchCond>`;

            try {
                const response = await this.requestXML("POST", url, xml_data, device);
                const result = this.parseLPRSearchResponse(response);
                const plates = result.plates;

                if (start_position === 0) {
                    total_matches = result.totalMatches;
                    console.log(`[Hikvision LPR] Hardware reports totalMatches: ${total_matches}`);
                }

                if (plates.length === 0 && result.numOfMatches === 0) {
                    console.log("[Hikvision LPR] No records in this page. Stopping.");
                    keep_fetching = false;
                } else {
                    all_plates = [...all_plates, ...plates];

                    const advancedBy = result.numOfMatches > 0 ? result.numOfMatches : plates.length;
                    start_position += advancedBy;

                    console.log(`[Hikvision LPR] Page Pos ${start_position - advancedBy}: Found ${plates.length} plates. Total collected: ${all_plates.length}/${total_matches}.`);

                    // Stop condition: Check for "OK" status (end of results) or if we got less than requested
                    const isLastPage = response.includes("<responseStatusStrg>OK</responseStatusStrg>") ||
                        (result.numOfMatches < page_size && result.numOfMatches >= 0);

                    if (isLastPage) {
                        console.log(`[Hikvision LPR] End of data reached (Status OK or partial page).`);
                        keep_fetching = false;
                    } else if (total_matches > 0 && start_position >= total_matches) {
                        console.log("[Hikvision LPR] Reached reported totalMatches. Stopping.");
                        keep_fetching = false;
                    }
                }
            } catch (error: any) {
                console.error(`[Hikvision LPR] Error at pos ${start_position}:`, error.message);
                keep_fetching = false;
            }

            if (start_position > 50000) break;
        }

        // Return all plates as found (Raw). This ensures the UI matches the hardware count.
        // We handle deduplication only when importing or syncing.
        console.log(`[Hikvision LPR] Finished exhaustive fetch. Total raw records: ${all_plates.length}`);
        return all_plates;
    }

    /**
     * Individual page fetch for progress tracking in UI
     */
    async getPlatesPage(device: Device, searchId: string, start: number, max: number = 400) {
        const url = `/ISAPI/Traffic/channels/1/searchLPListAudit`;
        const xml_data = `<?xml version="1.0" encoding="UTF-8"?><LPSearchCond><searchID>${searchId}</searchID><maxResult>${max}</maxResult><searchResultPosition>${start}</searchResultPosition></LPSearchCond>`;

        try {
            const response = await this.requestXML("POST", url, xml_data, device);
            const result = this.parseLPRSearchResponse(response);
            const isLastPage = response.includes("<responseStatusStrg>OK</responseStatusStrg>") ||
                (result.numOfMatches < max && result.numOfMatches >= 0);

            return {
                plates: result.plates,
                totalMatches: result.totalMatches,
                numOfMatches: result.numOfMatches,
                isLastPage
            };
        } catch (error: any) {
            console.error(`[Hikvision LPR] Error at pos ${start}:`, error.message);
            throw error;
        }
    }

    /**
     * Deletes ALL plates from the camera whitelist.
     * Matches the PHP 'deleteAllPlatesFromCamera' logic.
     */
    async clearWhiteList(device: Device): Promise<void> {
        const url = `/ISAPI/Traffic/channels/1/DelLicensePlateAuditData?format=json`;
        const payload = {
            id: [],
            deleteAllEnabled: true
        };

        try {
            console.log(`[Hikvision LPR] Clearing all plates from ${device.ip}...`);
            await this.request("PUT", url, payload, device);
        } catch (error: any) {
            console.error(`[Hikvision LPR] Failed to clear whitelist on ${device.ip}:`, error.message);
            throw error;
        }
    }

    async addPlateToCamera(device: Device, plate: string): Promise<void> {
        const url = `/ISAPI/Traffic/channels/1/licensePlateAuditData/record?format=json`;
        const now = new Date();
        const createTime = now.toISOString().split('.')[0].replace('Z', ''); // YYYY-MM-DDTHH:mm:ss
        const startDate = now.toISOString().split('T')[0];
        const end = new Date();
        end.setFullYear(end.getFullYear() + 10);
        const endDate = end.toISOString().split('T')[0];

        const payload = {
            LicensePlateInfoList: [
                {
                    LicensePlate: plate,
                    listType: "whiteList",
                    createTime: createTime,
                    effectiveStartDate: startDate,
                    effectiveTime: endDate,
                    id: ""
                }
            ]
        };

        await this.request("PUT", url, payload, device);
    }

    async getPlates(device: Device): Promise<string[]> {
        return this.getPlatesFromCamera(device);
    }

    async triggerRelay(device: Device): Promise<void> {
        // Hikvision ISAPI for Output/Relay
        // PUT /ISAPI/System/IO/outputs/1/trigger
        try {
            await this.request(
                "PUT",
                `/ISAPI/System/IO/outputs/1/trigger?format=json`,
                {
                    IOPortData: {
                        outputState: "high"
                    }
                },
                device
            );
        } catch (e: any) {
            console.error(`Failed to open gate ${device.ip}:`, e.message);
        }
    }

    private parseLPRSearchResponse(xml: string) {
        const plates = this.extractPlatesFromXML(xml);

        // Improved regex for totalMatches and numOfMatches to handle namespaces (e.g. <search:totalMatches> or <totalMatches xmlns="...">)
        const totalMatchesMatch = xml.match(/<(?:[^:>\s]+:)?totalMatches[^>]*>(\d+)<\/(?:[^:>\s]+:)?totalMatches>/i);
        const totalMatches = totalMatchesMatch ? parseInt(totalMatchesMatch[1]) : 0;

        const numOfMatchesMatch = xml.match(/<(?:[^:>\s]+:)?numOfMatches[^>]*>(\d+)<\/(?:[^:>\s]+:)?numOfMatches>/i);
        const numOfMatches = numOfMatchesMatch ? parseInt(numOfMatchesMatch[1]) : plates.length;

        console.log(`[Hikvision LPR Parser] XML Metadata -> totalMatches: ${totalMatches}, numOfMatches in this page: ${numOfMatches}`);

        return {
            plates,
            totalMatches: totalMatches || plates.length, // Fallback if not found but we got plates
            numOfMatches
        };
    }

    private extractPlatesFromXML(xml: string): string[] {
        const plates: string[] = [];
        // Support for a wider range of Hikvision LPR tags
        const tags = [
            "LicensePlate", "licensePlate", "plateNumber", "PlateNumber", "plateNo", "PlateNo", "plateNum"
        ];

        for (const tag of tags) {
            // Regex supporting optional namespace prefix and any attributes
            const regex = new RegExp(`<(?:[^:>\\s]+:)?${tag}[^>]*>([^<]+)</(?:[^:>\\s]+:)?${tag}>`, "gi");
            let match;
            while ((match = regex.exec(xml)) !== null) {
                // Filter out Hikvision placeholders and normalize
                const plate = match[1].trim().toUpperCase();
                if (plate && plate !== 'N/A' && plate !== '*' && plate.length > 2) {
                    plates.push(plate);
                }
            }
        }

        const uniquePlates = Array.from(new Set(plates));
        console.log(`[Hikvision XML Processor] Found ${uniquePlates.length} valid plates in response.`);
        return uniquePlates;
    }

    private async requestXML(
        method: "GET" | "POST" | "PUT" | "DELETE",
        url: string,
        data: string,
        device: Device
    ): Promise<string> {
        const username = device.username || "admin";
        const password = device.password || "12345";

        // Ensure IP doesn't already have a protocol 
        const host = (device.ip || "").replace(/^https?:\/\//, "");
        const baseURL = `http://${host}`;

        // Custom request logic for XML returning raw string
        // We can reuse the request logic but with different content-type
        try {
            const res = await axios.request({
                method,
                baseURL,
                url,
                data,
                headers: {
                    "Content-Type": "application/xml",
                    "Accept": "application/xml"
                },
                httpsAgent,
                timeout: 20000,
                responseType: 'text'
            });
            console.log(`[Hikvision XML] ${method} ${url} -> Status ${res.status}`);
            if (res.data) {
                console.log(`[Hikvision XML] Data Preview: ${String(res.data).slice(0, 300)}`);
            }
            return res.data;
        } catch (error: any) {
            const authHeader = error.response?.headers["www-authenticate"];
            console.log(`[Hikvision XML Error] 401 detected. Headers:`, JSON.stringify(error.response?.headers));
            if (error.response?.status === 401 && authHeader) {
                // Parse WWW-Authenticate header
                const getVal = (key: string) => {
                    const match = authHeader.match(new RegExp(`${key}="?([^",]+)"?`));
                    return match ? match[1].trim() : null;
                };

                const realm = getVal("realm");
                const nonce = getVal("nonce");
                const qop = getVal("qop");
                const opaque = getVal("opaque");
                const algorithm = getVal("algorithm") || "MD5";

                if (!realm || !nonce) throw error; // Re-throw if it wasn't a valid digest challenge

                // Calculate Response
                const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
                const ha2 = crypto.createHash("md5").update(`${method}:${url}`).digest("hex");

                const nc = "00000001";
                const cnonce = crypto.randomBytes(8).toString("hex");
                let response = "";

                if (qop === "auth") {
                    response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
                } else {
                    response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
                }

                let authString = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${url}", algorithm="${algorithm}", response="${response}"`;
                if (opaque) authString += `, opaque="${opaque}"`;
                if (qop) authString += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

                const res = await axios.request({
                    method,
                    baseURL,
                    url,
                    data,
                    headers: {
                        Authorization: authString,
                        "Content-Type": "application/xml",
                        "Accept": "application/xml"
                    },
                    httpsAgent,
                    timeout: 20000,
                    responseType: 'text'
                });
                console.log(`[Hikvision XML Retry] ${method} ${url} -> Status ${res.status}`);
                if (res.data) {
                    console.log(`[Hikvision XML Retry] Data Preview: ${String(res.data).slice(0, 300)}`);
                }
                return res.data;
            }
            throw error;
        }
    }

    async getFacesFromCamera(device: Device): Promise<any[]> {
        console.log(`[Hikvision Face] Starting face fetch for ${device.ip}`);
        const allFaces: any[] = [];
        let position = 0;
        const maxResults = 30;
        let method = "FDSearch"; // Start with Face Lib

        // Try to detect /ISAPI/AccessControl/UserInfo/Search capabilities first roughly by trying page 0
        try {
            await this.request("POST", "/ISAPI/AccessControl/UserInfo/Search?format=json", {
                UserInfoSearchCond: { searchID: "1", searchResultPosition: 0, maxResults: 1 }
            }, device);
            method = "UserInfo"; // Preference for UserInfo if it works (Terminals)
            console.log("[Hikvision Face] Detected Access Control Terminal (UserInfo)");
        } catch (e) {
            console.log("[Hikvision Face] AccessControl/UserInfo check failed, using FDSearch");
        }

        let keepFetching = true;

        while (keepFetching) {
            try {
                let matches: any[] = [];
                let totalMatches = 0;

                if (method === "UserInfo") {
                    // Access Control Terminal (MinMoe)
                    const url = `/ISAPI/AccessControl/UserInfo/Search?format=json`;
                    const payload = {
                        UserInfoSearchCond: {
                            searchID: "1",
                            searchResultPosition: position,
                            maxResults: maxResults
                        }
                    };
                    const data = await this.request("POST", url, payload, device);

                    if (data.UserInfoSearch) {
                        const info = data.UserInfoSearch;
                        totalMatches = info.totalMatches || 0;
                        if (info.UserInfo && Array.isArray(info.UserInfo)) matches = info.UserInfo;
                    }

                    // Map Access Control UserInfo to Generic Face Object
                    matches = matches.map(m => ({
                        ...m,
                        FPID: m.employeeNo,
                        name: m.name,
                        // FaceURL might not be in UserInfo search. Usually requires /ISAPI/Intelligent/FDLib/FaceDataRecord?
                        // Or /ISAPI/AccessControl/UserInfo/Detail?
                        // For now we list users.
                        faceURL: m.faceURL || "" // Might be empty
                    }));

                } else {
                    // Face Library (NVR/IPC) behavior
                    const url = `/ISAPI/Intelligent/FDLib/FDSearch?format=json`;
                    const payload = {
                        searchResultPosition: position,
                        maxResults: maxResults
                    };
                    const data = await this.request("POST", url, payload, device);

                    if (data.MatchList) {
                        // JSON structure variations
                        if (Array.isArray(data.MatchList)) matches = data.MatchList;
                        else if (data.MatchList.matchList && Array.isArray(data.MatchList.matchList)) matches = data.MatchList.matchList;
                    } else if (data.matchList) {
                        matches = data.matchList;
                    }
                    totalMatches = data.totalMatches || 0;
                }

                if (matches.length > 0) {
                    allFaces.push(...matches);
                    position += matches.length;
                    console.log(`[Hikvision Face] Fetched ${matches.length} items (${method}). Total: ${allFaces.length}`);

                    if (matches.length < maxResults) keepFetching = false;
                    // Strict Total check
                    if (totalMatches > 0 && position >= totalMatches) keepFetching = false;
                } else {
                    console.log(`[Hikvision Face] No more matches found.`);
                    keepFetching = false;
                }

            } catch (error: any) {
                console.error(`[Hikvision Face] Error fetching (${method}): ${error.message}`);
                // If it fails on page X, maybe safer to stop to avoid infinite loop
                keepFetching = false;
            }

            if (position > 5000) keepFetching = false; // Safety
        }

        return allFaces;
    }
}
