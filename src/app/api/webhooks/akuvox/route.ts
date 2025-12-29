import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccessDecision } from "@prisma/client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("Akuvox Event:", body);

        // Assume Akuvox sends JSON with face/card info
        // Example: { "ext_id": "123", "card_no": "...", "event_type": "access", "photo_url": "..." }

        // Logic similar to Hikvision but simpler JSON parsing
        // AccessEvent generation...

        return NextResponse.json({ status: "received" });
    } catch (error: any) {
        console.error("Akuvox Webhook Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
