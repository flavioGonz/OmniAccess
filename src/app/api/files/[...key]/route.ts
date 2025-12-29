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
        const keyParts = params.key;

        if (!keyParts || keyParts.length < 2) {
            return new NextResponse("Invalid file path", { status: 400 });
        }

        const bucketName = keyParts[0];
        const fileKey = keyParts.slice(1).join("/");

        const command = new GetObjectCommand({
            Bucket: bucketName || BUCKET_NAME,
            Key: fileKey,
        });

        const response = await s3Client.send(command);

        if (!response.Body) {
            return new NextResponse("File not found", { status: 404 });
        }

        const byteArray = await (response.Body as any).transformToByteArray();

        console.log(`[S3 Proxy] Serving ${fileKey} from ${bucketName} (${byteArray.length} bytes)`);

        return new Response(byteArray, {
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
