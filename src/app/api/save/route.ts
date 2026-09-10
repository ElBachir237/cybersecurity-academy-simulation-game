import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, saves } from "@/db/schema";
import { SAVE_VERSION } from "@/game/save-version";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile = body?.profile;
    const state = body?.state;
    if (!profile?.name || !state) {
      return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
    }
    const profileId = String(profile.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await db
      .insert(profiles)
      .values({
        id: profileId,
        name: String(profile.name),
        avatar: String(profile.avatar ?? "a1"),
        lang: profile.lang === "en" ? "en" : "fr",
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          name: String(profile.name),
          avatar: String(profile.avatar ?? "a1"),
          lang: profile.lang === "en" ? "en" : "fr",
          lastSeenAt: new Date(),
        },
      });
    await db
      .insert(saves)
      .values({ profileId, version: SAVE_VERSION, state, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: saves.profileId,
        set: { version: SAVE_VERSION, state, updatedAt: new Date() },
      });
    return NextResponse.json({ ok: true, profileId });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "save failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ ok: false, error: "missing profileId" }, { status: 400 });
  }
  const rows = await db.select().from(saves).where(eq(saves.profileId, profileId));
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, state: rows[0].state });
}
