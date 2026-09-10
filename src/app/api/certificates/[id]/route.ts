import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const rows = await db.select().from(certificates).where(eq(certificates.id, id));
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  const c = rows[0];
  return NextResponse.json({
    ok: true,
    certificate: {
      id: c.id,
      holderName: c.holderName,
      titleKey: c.titleKey,
      level: c.level,
      skills: c.skills,
      score: c.score,
      issuedAt: c.issuedAt,
    },
  });
}
