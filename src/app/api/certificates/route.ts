import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { certificates } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.id || !body?.holderName || !body?.titleKey) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    await db
      .insert(certificates)
      .values({
        id: String(body.id),
        profileId: String(body.profileId ?? "anonymous"),
        holderName: String(body.holderName),
        titleKey: String(body.titleKey),
        level: String(body.level ?? "Chapter 1"),
        skills: body.skills ?? [],
        score: Number(body.score ?? 0),
      })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
