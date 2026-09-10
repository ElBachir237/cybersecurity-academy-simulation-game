"use client";

// ============================================================
// Certificate verification — search form with format validation
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/game/ui";

const ID_RE = /^HZN-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export default function VerifyPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = id.trim().toUpperCase();
    if (!clean) {
      setError("Saisissez un identifiant.");
      return;
    }
    if (!ID_RE.test(clean)) {
      setError("Format attendu : HZN-XXXX-XXXX (chiffres et lettres).");
      return;
    }
    setError("");
    router.push(`/verify/${clean}`);
  };

  return (
    <div className="hz-grid-bg flex min-h-screen items-center justify-center bg-hz-bg p-4">
      <div className="hz-card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-hz-accent/40 bg-hz-accent/10">
            <Icon name="badge" size={22} className="text-hz-accent" />
          </div>
          <h1 className="text-[19px] font-black">Vérification d'attestation</h1>
          <p className="mt-1 text-[12.5px] text-hz-muted">
            Saisissez l'identifiant d'une attestation délivrée par l'Académie
            HORIZON.
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={id}
              onChange={(e) => {
                setId(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="HZN-XXXX-XXXX"
              maxLength={14}
              className="hz-input flex-1 font-mono uppercase"
              aria-invalid={!!error}
            />
            <button type="submit" className="hz-btn hz-btn-primary">
              <Icon name="search" size={15} />
              Vérifier
            </button>
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-[12px] text-hz-red">
              <Icon name="error" size={13} />
              {error}
            </p>
          )}
        </form>
        <p className="mt-4 text-center text-[10.5px] text-hz-muted">
          Attestation interne à l'Académie HORIZON — ce n'est pas une
          certification officielle externe.
        </p>
      </div>
    </div>
  );
}
