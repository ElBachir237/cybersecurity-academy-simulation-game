// ============================================================
// Certificate verification — public result page (server)
// ============================================================

import { db } from "@/db";
import { certificates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Icon } from "@/components/game/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VerifyCertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(certificates)
    .where(eq(certificates.id, id.toUpperCase()));
  const cert = rows[0];

  return (
    <div className="hz-grid-bg flex min-h-screen items-center justify-center bg-hz-bg p-4">
      <div className="w-full max-w-lg">
        {cert ? (
          <div className="hz-card overflow-hidden anim-fade-up">
            <div
              className="border-b border-hz-border p-6 text-center"
              style={{
                background:
                  "linear-gradient(160deg, rgba(53,224,210,0.08), transparent)",
              }}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-hz-green/15">
                <Icon name="success" size={22} className="text-hz-green" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-hz-accent">
                HORIZON CYBER ACADEMY
              </p>
              <h1 className="mt-1 text-[20px] font-black">
                Attestation valide
              </h1>
            </div>
            <div className="p-6">
              <Row label="Identifiant" value={cert.id} mono />
              <Row label="Titulaire" value={cert.holderName} />
              <Row label="Titre" value={cert.titleKey} />
              <Row label="Niveau" value={cert.level} />
              <Row label="Score" value={`${cert.score}/100`} />
              <Row
                label="Délivré le"
                value={new Date(cert.issuedAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
              <div className="mt-4">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-hz-muted">
                  Compétences validées
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(cert.skills as { id: string; label: string; level: string }[]).map(
                    (s) => (
                      <span
                        key={s.id}
                        className="rounded-full border border-hz-border px-2.5 py-1 text-[11px] text-hz-text/85"
                      >
                        {s.label}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-hz-border p-4 text-center">
              <p className="text-[10.5px] italic text-hz-muted">
                Signé numériquement — Académie HORIZON (interne). Ce n'est pas
                une certification officielle externe.
              </p>
            </div>
          </div>
        ) : (
          <div className="hz-card p-8 text-center anim-fade-up">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-hz-red/15">
              <Icon name="error" size={22} className="text-hz-red" />
            </div>
            <h1 className="text-[19px] font-black">Attestation introuvable</h1>
            <p className="mt-2 text-[13px] text-hz-muted">
              Aucune attestation ne correspond à l'identifiant{" "}
              <span className="font-mono font-bold text-hz-text">{id}</span>.
              Vérifiez l'identifiant ou contactez l'Académie.
            </p>
          </div>
        )}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-[12px] text-hz-muted underline-offset-4 hover:text-hz-accent hover:underline"
          >
            ← Retour à HORIZON OS
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-hz-border/50 py-2.5 text-[13px]">
      <span className="text-hz-muted">{label}</span>
      <span className={`font-semibold ${mono ? "font-mono text-hz-accent" : ""}`}>
        {value}
      </span>
    </div>
  );
}
