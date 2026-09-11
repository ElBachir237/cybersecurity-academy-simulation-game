import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, saves } from "@/db/schema";
import { SAVE_VERSION } from "@/game/save-version";

export const dynamic = "force-dynamic";

/**
 * POST /api/save
 * Save game state + profile.
 * Returns { ok: true, profileId } or error.
 */
export async function POST(req: NextRequest) {
  try {
    // Check auth header (basic for now; upgrade to JWT later)
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const profile = body?.profile;
    const state = body?.state;

    if (!profile?.name || !state) {
      return NextResponse.json(
        { ok: false, error: "invalid payload" },
        { status: 400 }
      );
    }

    // Sanitize profileId
    const profileId = String(profile.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");

    // Upsert profile
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

    // Upsert save
    await db
      .insert(saves)
      .values({
        profileId,
        version: SAVE_VERSION,
        state,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: saves.profileId,
        set: {
          version: SAVE_VERSION,
          state,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true, profileId, savedAt: Date.now() });
  } catch (e) {
    console.error("POST /api/save failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "save failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/save?profileId=...
 * Load game state for a profile.
 * Returns { ok: true, state } or error.
 */
export async function GET(req: NextRequest) {
  try {
    // Check auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const profileId = req.nextUrl.searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: "missing profileId" },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(saves)
      .where(eq(saves.profileId, profileId));

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      state: rows[0].state,
      updatedAt: rows[0].updatedAt,
    });
  } catch (e) {
    console.error("GET /api/save failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "load failed" },
      { status: 500 }
    );
  }
}