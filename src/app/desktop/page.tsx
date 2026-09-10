"use client";

// ============================================================
// HORIZON OS — Desktop page (game shell)
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GameProvider } from "@/components/game/context";
import Desktop from "@/components/game/Desktop";
import { GameEngine, getEngine, loadLocalSave, setEngine } from "@/game/engine";
import { Icon } from "@/components/game/ui";

export default function DesktopPage() {
  const router = useRouter();
  const [engine, setEng] = useState<GameEngine | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let eng = getEngine();
    if (!eng) {
      const saved = loadLocalSave();
      if (!saved?.state?.profile) {
        setFailed(true);
        const id = setTimeout(() => router.replace("/"), 1200);
        return () => clearTimeout(id);
      }
      eng = new GameEngine(saved.state);
      setEngine(eng);
    }
    setEng(eng);
  }, [router]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-hz-bg text-hz-muted">
        <Icon name="lock" size={26} />
        <p className="text-[13px]">Aucun profil trouvé — redirection…</p>
      </div>
    );
  }

  if (!engine) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hz-bg">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-hz-accent/40 bg-hz-accent/10 anim-ring">
          <Icon name="terminal" size={26} className="text-hz-accent" />
        </div>
        <p className="text-[12px] uppercase tracking-[0.3em] text-hz-muted">
          HORIZON OS
        </p>
      </div>
    );
  }

  return (
    <GameProvider engine={engine}>
      <Desktop />
    </GameProvider>
  );
}
