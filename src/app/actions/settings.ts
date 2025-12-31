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

export async function getSetting(key: string) {
    const setting = await prisma.setting.findUnique({
        where: { key },
    });
    return setting;
}

export async function updateSetting(key: string, value: string) {
    const setting = await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
    });
    revalidatePath("/admin/configuracion");
    return setting;
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
    const [endpoint, accessKey, secretKey] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "S3_ENDPOINT" } }),
        prisma.setting.findUnique({ where: { key: "S3_ACCESS_KEY" } }),
        prisma.setting.findUnique({ where: { key: "S3_SECRET_KEY" } }),
    ]);

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
