import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/certificates
 * Issue a certificate (internal only — requires Bearer token).
 */
export async function POST(req: NextRequest) {
  try {
    // Require auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      id,
      profileId,
      holderName,
      titleKey,
      level,
      skills,
      score,
    } = body;

    if (!id || !profileId || !holderName || !titleKey) {
      return NextResponse.json(
        { ok: false, error: "missing required fields" },
        { status: 400 }
      );
    }

    await db.insert(certificates).values({
      id,
      profileId,
      holderName,
      titleKey,
      level: level ?? "practice",
      skills: skills ?? [],
      score: score ?? 0,
    });

    return NextResponse.json({ ok: true, certificateId: id });
  } catch (e) {
    console.error("POST /api/certificates failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "issue failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/certificates?profileId=...
 * List certificates for a profile.
 * Public endpoint (no auth required).
 */
export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json(
        { ok: false, error: "missing profileId" },
        { status: 400 }
      );
    }

    const certs = await db
      .select()
      .from(certificates)
      .where(eq(certificates.profileId, profileId));

    return NextResponse.json({ ok: true, certificates: certs });
  } catch (e) {
    console.error("GET /api/certificates failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "query failed" },
      { status: 500 }
    );
  }
}