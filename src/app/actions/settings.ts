"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
    S3Client,
    ListObjectsV2Command,
    GetBucketLifecycleConfigurationCommand,
    PutBucketLifecycleConfigurationCommand,
    HeadObjectCommand
} from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";
import axios from "axios";

// ... existing code ...

export async function getSetting(key: string) {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key },
        });
        return setting;
    } catch (error) {
        console.error(`Error getting setting ${key}:`, error);
        return null;
    }
}

export async function updateSetting(key: string, value: string) {
    try {
        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
        revalidatePath("/admin/configuracion");
        return setting;
    } catch (error) {
        console.error(`Error updating setting ${key}:`, error);
        throw error; // Re-throw for update actions so UI shows error
    }
}

export async function purgeAccessEvents() {
    console.log("Starting purge process...");

    const retentionSetting = await getSetting("dataRetentionMonths");
    const retentionMonths = retentionSetting ? parseInt(retentionSetting.value, 10) : 6; // Default to 6 months if not set

    if (isNaN(retentionMonths) || retentionMonths <= 0) {
        console.error("Invalid retention period. Aborting purge.");
        throw new Error("Período de retención inválido.");
    }

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

    console.log(`Purging events older than: ${cutoffDate.toISOString()}`);

    try {
        const { count } = await prisma.accessEvent.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate,
                },
            },
        });

        console.log(`Successfully purged ${count} events.`);
        revalidatePath("/admin/history"); // Revalidate history page after purge
        return { success: true, count };

    } catch (error) {
        console.error("Failed to purge old access events:", error);
        throw new Error("La purga de eventos falló.");
    }
}

async function getS3InternalClient() {
    let endpoint, accessKey, secretKey;
    try {
        [endpoint, accessKey, secretKey] = await Promise.all([
            prisma.setting.findUnique({ where: { key: "S3_ENDPOINT" } }),
            prisma.setting.findUnique({ where: { key: "S3_ACCESS_KEY" } }),
            prisma.setting.findUnique({ where: { key: "S3_SECRET_KEY" } }),
        ]);
    } catch (e) {
        console.warn("Failed to fetch S3 settings from DB, falling back to env/defaults", e);
    }

    return new S3Client({
        endpoint: endpoint?.value || process.env.S3_ENDPOINT || "http://192.168.99.108:9000",
        region: "us-east-1",
        credentials: {
            accessKeyId: accessKey?.value || process.env.S3_ACCESS_KEY || "root",
            secretAccessKey: secretKey?.value || process.env.S3_SECRET_KEY || "flavio20",
        },
        forcePathStyle: true,
    });
}

export async function getBucketLifecycle(bucketName: string) {
    try {
        const client = await getS3InternalClient();
        const command = new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName });
        const response = await client.send(command);
        return { success: true, days: response.Rules?.[0]?.Expiration?.Days || 0 };
    } catch (error: any) {
        if (error.name === 'NoSuchLifecycleConfiguration') return { success: true, days: 0 };
        return { success: false, message: error.message };
    }
}

export async function updateBucketLifecycle(bucketName: string, days: number) {
    try {
        const client = await getS3InternalClient();
        const command = new PutBucketLifecycleConfigurationCommand({
            Bucket: bucketName,
            LifecycleConfiguration: {
                Rules: days > 0 ? [
                    {
                        ID: `RetentionRule-${bucketName}`,
                        Status: "Enabled",
                        Filter: { Prefix: "" },
                        Expiration: { Days: days }
                    }
                ] : []
            }
        });
        await client.send(command);
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function testS3Connection(bucketType: "lpr" | "face" = "lpr") {
    try {
        // Fetch config from DB
        const [endpoint, accessKey, secretKey, bucketLpr, bucketFace] = await Promise.all([
            prisma.setting.findUnique({ where: { key: "S3_ENDPOINT" } }),
            prisma.setting.findUnique({ where: { key: "S3_ACCESS_KEY" } }),
            prisma.setting.findUnique({ where: { key: "S3_SECRET_KEY" } }),
            prisma.setting.findUnique({ where: { key: "S3_BUCKET_LPR" } }),
            prisma.setting.findUnique({ where: { key: "S3_BUCKET_FACE" } }),
        ]);

        const config = {
            endpoint: endpoint?.value || process.env.S3_ENDPOINT || "http://192.168.99.108:9000",
            accessKey: accessKey?.value || process.env.S3_ACCESS_KEY || "root",
            secretKey: secretKey?.value || process.env.S3_SECRET_KEY || "flavio20",
            bucketName: bucketType === "lpr"
                ? (bucketLpr?.value || process.env.S3_BUCKET || "lpr")
                : (bucketFace?.value || "face")
        };

        const client = new S3Client({
            endpoint: config.endpoint,
            region: "us-east-1",
            credentials: {
                accessKeyId: config.accessKey,
                secretAccessKey: config.secretKey,
            },
            forcePathStyle: true,
        });

        const command = new ListObjectsV2Command({
            Bucket: config.bucketName,
            MaxKeys: 1
        });

        await client.send(command);
        return { success: true, message: `Conexión exitosa al bucket "${config.bucketName}"` };
    } catch (error: any) {
        console.error("S3 Test Connection Failed:", error);
        return {
            success: false,
            message: `Error de conexión: ${error.message || "Error desconocido"}`
        };
    }
}

export async function getBucketStats(bucketName: string) {
    try {
        const client = await getS3InternalClient();
        let totalSize = 0;
        let fileCount = 0;

        const fetchObjects = async (token?: string): Promise<void> => {
            const cmd = new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: token,
            });

            const res = await client.send(cmd);

            if (res.Contents) {
                fileCount += res.Contents.length;
                for (const obj of res.Contents) {
                    totalSize += obj.Size || 0;
                }
            }

            if (res.IsTruncated && res.NextContinuationToken) {
                await fetchObjects(res.NextContinuationToken);
            }
        };

        await fetchObjects();

        return {
            success: true,
            size: totalSize,
            count: fileCount
        };
    } catch (error: any) {
        console.error(`Error getting stats for bucket ${bucketName}:`, error);
        return { success: false, message: error.message };
    }
}

export async function testDbConnection() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { success: true, message: "Conexión a base de datos exitosa" };
    } catch (error: any) {
        console.error("DB Connection Failed:", error);
        return { success: false, message: error.message };
    }
}

export async function getDbStats() {
    try {
        const dbSizeQuery: any[] = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;

        const tableStats: any[] = await prisma.$queryRaw`
            SELECT 
                relname as table_name,
                n_live_tup as row_count,
                pg_size_pretty(pg_total_relation_size(relid)) as total_size
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC;
        `;

        return {
            success: true,
            totalSize: dbSizeQuery[0]?.size || "0 B",
            tables: tableStats
        };
    } catch (error: any) {
        console.error("Error getting DB stats:", error);
        return { success: false, message: error.message };
    }
}

export async function downloadBackup() {
    try {
        // En una implementación real con pg_dump sería mejor, pero para propósitos demostrativos
        // y portabilidad, podemos exportar las tablas principales a JSON
        const [users, vehicles, devices, events, units] = await Promise.all([
            prisma.user.findMany(),
            prisma.vehicle.findMany(),
            prisma.device.findMany(),
            prisma.accessEvent.findMany({ take: 1000, orderBy: { timestamp: 'desc' } }), // Limitamos eventos por tamaño
            prisma.unit.findMany(),
        ]);

        const backupData = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            data: { users, vehicles, devices, events, units }
        };

        return { success: true, data: backupData };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function saveHikvisionBrands(brands: Record<string, string>) {
    try {
        // Convert to sorted object string
        const sortedKeys = Object.keys(brands).sort((a, b) => parseInt(a) - parseInt(b));
        const entries = sortedKeys.map(key => `    ${key}: '${brands[key].replace(/'/g, "\\'")}'`).join(',\n');

        // 1. Update TS file
        const tsPath = path.join(process.cwd(), 'src', 'lib', 'hikvision-codes.ts');
        let tsContent = await fs.readFile(tsPath, 'utf8');

        const tsRegex = /(export const HIKVISION_VEHICLE_BRANDS: \{ \[key: number\]: string \} = \{)[\s\S]*?(\};)/;
        if (tsRegex.test(tsContent)) {
            const newTsBlock = `$1\n${entries}\n$2`;
            tsContent = tsContent.replace(tsRegex, newTsBlock);
            await fs.writeFile(tsPath, tsContent, 'utf8');
        } else {
            console.error("Could not find HIKVISION_VEHICLE_BRANDS in hikvision-codes.ts");
        }

        // 2. Update JS file
        const jsPath = path.join(process.cwd(), 'hikvision-codes.js');
        let jsContent = await fs.readFile(jsPath, 'utf8');

        // JS uses: const HIKVISION_VEHICLE_BRANDS = { ...
        const jsRegex = /(const HIKVISION_VEHICLE_BRANDS = \{)[\s\S]*?(\};)/;
        if (jsRegex.test(jsContent)) {
            const newJsBlock = `$1\n${entries}\n$2`;
            jsContent = jsContent.replace(jsRegex, newJsBlock);
            await fs.writeFile(jsPath, jsContent, 'utf8');
        } else {
            console.error("Could not find HIKVISION_VEHICLE_BRANDS in hikvision-codes.js");
        }

        return { success: true };
    } catch (error: any) {
        console.error("Failed to save brands:", error);
        return { success: false, message: error.message };
    }
}

export async function testWahaConnection(url: string, apiKey?: string) {
    try {
        const headers: any = {};
        if (apiKey) headers['X-Api-Key'] = apiKey;

        const response = await axios.get(`${url}/api/sessions`, {
            headers,
            timeout: 5000
        });

        return {
            success: true,
            sessions: response.data,
            message: "Conexión exitosa con WAHA"
        };
    } catch (error: any) {
        console.error("WAHA Test Connection Failed:", error);
        return {
            success: false,
            message: `Error de conexión: ${error.response?.data?.message || error.message}`
        };
    }
}

export async function getWahaSessions(url: string, apiKey?: string) {
    try {
        const headers: any = {};
        if (apiKey) headers['X-Api-Key'] = apiKey;

        const response = await axios.get(`${url}/api/sessions`, { headers });
        return { success: true, data: response.data };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
