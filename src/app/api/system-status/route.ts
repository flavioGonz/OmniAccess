import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function GET(req: NextRequest) {
    const status: any = {};

    // 1. Check Primary Database
    try {
        const startDb = performance.now();
        const result = await prisma.$queryRaw`SELECT 
            pg_database_size(current_database()) as size,
            (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
            (SELECT count(*) FROM pg_stat_activity) as connections,
            version() as version`;

        const dbInfo: any = Array.isArray(result) ? result[0] : result;

        status.primaryDb = {
            status: 'connected',
            latency: Math.floor(performance.now() - startDb),
            details: {
                size: Number(dbInfo.size),
                tableCount: Number(dbInfo.table_count),
                connections: Number(dbInfo.connections),
                version: dbInfo.version?.split(' ')[1] || 'Unknown'
            }
        };
    } catch (error: any) {
        console.error("Primary DB Check Failed:", error?.message);
        status.primaryDb = { status: 'error', latency: 0 };
    }

    // 2. Check MinIO (S3)
    try {
        const [endpoint, accessKey, secretKey, bucketLpr, bucketFace] = await Promise.all([
            prisma.setting.findUnique({ where: { key: "S3_ENDPOINT" } }),
            prisma.setting.findUnique({ where: { key: "S3_ACCESS_KEY" } }),
            prisma.setting.findUnique({ where: { key: "S3_SECRET_KEY" } }),
            prisma.setting.findUnique({ where: { key: "S3_BUCKET_LPR" } }),
            prisma.setting.findUnique({ where: { key: "S3_BUCKET_FACE" } }),
        ]);

        const s3Endpoint = endpoint?.value || process.env.S3_ENDPOINT || "http://192.168.99.108:9000";
        const startMinio = performance.now();

        const client = new S3Client({
            endpoint: s3Endpoint,
            region: "us-east-1",
            credentials: {
                accessKeyId: accessKey?.value || "root",
                secretAccessKey: secretKey?.value || "flavio20",
            },
            forcePathStyle: true,
        });

        const bucketName = bucketLpr?.value || "lpr";
        const faceBucket = bucketFace?.value || "face";

        const [resLpr, resFace] = await Promise.all([
            client.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 })).catch(() => null),
            client.send(new ListObjectsV2Command({ Bucket: faceBucket, MaxKeys: 1 })).catch(() => null)
        ]);

        if (resLpr || resFace) {
            status.minio = {
                status: 'connected',
                latency: Math.floor(performance.now() - startMinio),
                details: {
                    bucket: bucketName,
                    faceBucket: faceBucket,
                    endpoint: s3Endpoint.replace('http://', '').replace('https://', ''),
                    status: "Healthy"
                }
            };
        } else {
            status.minio = { status: 'error', latency: 0 };
        }
    } catch (error: any) {
        console.error("MinIO Check Failed:", error?.message);
        status.minio = { status: 'error', latency: 0 };
    }

    // 3. Check WAHA (WhatsApp)
    try {
        const wahaUrlSetting = await prisma.setting.findUnique({ where: { key: 'WAHA_URL' } });
        const wahaApiKeySetting = await prisma.setting.findUnique({ where: { key: 'WAHA_API_KEY' } });

        const wahaUrl = wahaUrlSetting?.value;

        if (wahaUrl) {
            const startWaha = performance.now();
            const headers: any = {};
            if (wahaApiKeySetting?.value) headers['X-Api-Key'] = wahaApiKeySetting.value;

            const response = await axios.get(`${wahaUrl}/api/sessions`, {
                timeout: 3000,
                headers
            });

            status.waha = {
                status: 'connected',
                latency: Math.floor(performance.now() - startWaha),
                details: {
                    sessions: response.data?.length || 0,
                    endpoint: wahaUrl.replace('http://', '').replace('https://', '')
                }
            };
        } else {
            status.waha = { status: 'disabled', latency: 0 };
        }
    } catch (error: any) {
        console.error("WAHA Check Failed:", error?.message);
        status.waha = { status: 'error', latency: 0 };
    }

    return NextResponse.json(status);
}
