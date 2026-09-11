import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/verify/[certId]
 * Public certificate verification endpoint.
 * No auth required — anyone can verify a cert.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await context.params;

    if (!certId) {
      return NextResponse.json(
        { ok: false, error: "missing certId" },
        { status: 400 }
      );
    }

    const certs = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, certId));

    if (!certs.length) {
      return NextResponse.json(
        { ok: false, error: "certificate not found" },
        { status: 404 }
      );
    }

    const cert = certs[0];
    return NextResponse.json({
      ok: true,
      id: cert.id,
      holderName: cert.holderName,
      titleKey: cert.titleKey,
      level: cert.level,
      skills: cert.skills,
      score: cert.score,
      issuedAt: cert.issuedAt,
      verifiedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("GET /api/verify failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "verify failed" },
      { status: 500 }
    );
  }
}