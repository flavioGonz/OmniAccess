import { NextRequest, NextResponse } from "next/server";
import { getS3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const BUCKET_NAME = process.env.S3_BUCKET || "lpr";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ key: string[] }> }
) {
    try {
        const params = await context.params;
        const s3Client = await getS3Client();
        let keyParts = params.key;

        // Resilience: Handle potential double prefixing (api/files/api/files/...)
        while (keyParts.length > 2 && keyParts[0] === 'api' && keyParts[1] === 'files') {
            keyParts = keyParts.slice(2);
        }

        if (!keyParts || keyParts.length < 2) {
            return new NextResponse("Invalid file path", { status: 400 });
        }

        const bucketName = keyParts[0];
        const fileKey = keyParts.slice(1).join("/");

        console.log(`[S3 Proxy] Attempting to fetch: ${fileKey} from bucket: ${bucketName}`);

        const command = new GetObjectCommand({
            Bucket: bucketName || BUCKET_NAME,
            Key: fileKey,
        });

        const response = await s3Client.send(command);

        if (!response.Body) {
            return new NextResponse("File not found", { status: 404 });
        }

        const byteArray = await new Promise<Buffer>((resolve, reject) => {
            const chunks: any[] = [];
            (response.Body as any).on('data', (chunk: any) => chunks.push(chunk));
            (response.Body as any).on('error', reject);
            (response.Body as any).on('end', () => resolve(Buffer.concat(chunks)));
        });

        console.log(`[S3 Proxy] Serving ${fileKey} from ${bucketName} (${byteArray.length} bytes)`);

        return new Response(byteArray as any, {
            status: 200,
            headers: {
                "Content-Type": response.ContentType || "image/jpeg",
                "Content-Length": byteArray.length.toString(),
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error: any) {
        console.error("[S3 Proxy] Critical Failure fetching:", error);
        if (error.name === "NoSuchKey") {
            return new Response("File not found in S3", { status: 404 });
        }
        return new Response(`Error fetching file: ${error.message}`, { status: 500 });
    }
}
