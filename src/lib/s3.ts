import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { prisma } from "./prisma";

async function getS3Config() {
    // Try to get from database first
    const [endpoint, accessKey, secretKey, bucketLpr, bucketFace] = await Promise.all([
        prisma.setting.findUnique({ where: { key: "S3_ENDPOINT" } }),
        prisma.setting.findUnique({ where: { key: "S3_ACCESS_KEY" } }),
        prisma.setting.findUnique({ where: { key: "S3_SECRET_KEY" } }),
        prisma.setting.findUnique({ where: { key: "S3_BUCKET_LPR" } }),
        prisma.setting.findUnique({ where: { key: "S3_BUCKET_FACE" } }),
    ]);

    return {
        endpoint: endpoint?.value || process.env.S3_ENDPOINT || "http://192.168.99.108:9000",
        accessKey: accessKey?.value || process.env.S3_ACCESS_KEY || "root",
        secretKey: secretKey?.value || process.env.S3_SECRET_KEY || "flavio20",
        bucketLpr: bucketLpr?.value || process.env.S3_BUCKET || "lpr",
        bucketFace: bucketFace?.value || "face"
    };
}

export async function uploadToS3(
    fileBuffer: Buffer | ArrayBuffer,
    filename: string,
    contentType: string,
    bucketType: "lpr" | "face" = "lpr"
) {
    const config = await getS3Config();

    const s3Client = new S3Client({
        endpoint: config.endpoint,
        region: "us-east-1",
        credentials: {
            accessKeyId: config.accessKey,
            secretAccessKey: config.secretKey,
        },
        forcePathStyle: true,
    });

    const bucketName = bucketType === "lpr" ? config.bucketLpr : config.bucketFace;

    console.log(`[S3] Starting upload: ${filename} to bucket: ${bucketName} (Endpoint: ${config.endpoint})`);

    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: bucketName,
            Key: filename,
            Body: fileBuffer instanceof ArrayBuffer ? Buffer.from(fileBuffer) : fileBuffer,
            ContentType: contentType,
        },
    });

    await upload.done();
    return `/api/files/${bucketName}/${filename}`;
}

// Helper to get client for the proxy
export async function getS3Client() {
    const config = await getS3Config();
    return new S3Client({
        endpoint: config.endpoint,
        region: "us-east-1",
        credentials: {
            accessKeyId: config.accessKey,
            secretAccessKey: config.secretKey,
        },
        forcePathStyle: true,
    });
}
