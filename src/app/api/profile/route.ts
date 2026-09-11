import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, saves } from "@/db/schema";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile
 * Get current authenticated user's profile + save.
 * Returns { ok: true, profile, state } or 401.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: "not authenticated" },
        { status: 401 }
      );
    }

    const email = session.user.email;
    
    // Get profile by email
    const profileRows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email));

    if (!profileRows.length) {
      return NextResponse.json(
        { ok: false, error: "profile not found" },
        { status: 404 }
      );
    }

    const profile = profileRows[0];
    const profileId = profile.id;

    // Get latest save
    const saveRows = await db
      .select()
      .from(saves)
      .where(eq(saves.profileId, profileId));

    return NextResponse.json({
      ok: true,
      profile: {
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar,
        lang: profile.lang,
        email: profile.email,
        createdAt: profile.createdAt,
      },
      state: saveRows.length ? saveRows[0].state : null,
    });
  } catch (e) {
    console.error("GET /api/profile failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "query failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile
 * Create or update profile for authenticated user.
 * Used after Google login.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, error: "not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, avatar, lang } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "name required" },
        { status: 400 }
      );
    }

    const email = session.user.email;
    const profileId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Upsert profile (linked to email)
    await db
      .insert(profiles)
      .values({
        id: profileId,
        name,
        avatar: avatar ?? "a1",
        lang: lang ?? "fr",
        email,
        verified: true, // Verified via Google
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          name,
          avatar: avatar ?? "a1",
          lang: lang ?? "fr",
          email,
          lastSeenAt: new Date(),
        },
      });

    return NextResponse.json({
      ok: true,
      profileId,
      email,
    });
  } catch (e) {
    console.error("POST /api/profile failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "update failed" },
      { status: 500 }
    );
  }
}