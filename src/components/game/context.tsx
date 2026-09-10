"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { GameEngine } from "@/game/engine";
import type { GameState } from "@/game/types";
import { makeT, type TFn } from "@/game/i18n";

interface GameCtx {
  engine: GameEngine;
  state: GameState;
  t: TFn;
  overlayCount: number;
  registerOverlay: () => () => void;
}

const Ctx = createContext<GameCtx | null>(null);

export function GameProvider({ engine, children }: { engine: GameEngine; children: ReactNode }) {
  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);
  // UI focus ownership is deliberately not part of a saved game.
  const [overlays, setOverlays] = useState<Set<symbol>>(() => new Set());
  const registerOverlay = useCallback(() => {
    const id = Symbol("dialog");
    setOverlays((prev) => new Set(prev).add(id));
    return () => setOverlays((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const t = useMemo(() => makeT(state.profile?.lang ?? "fr"), [state.profile?.lang]);
  const value = useMemo(
    () => ({ engine, state, t, overlayCount: overlays.size, registerOverlay }),
    [engine, state, t, overlays.size, registerOverlay],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameCtx {
  const value = useContext(Ctx);
  if (!value) throw new Error("useGame must be used within GameProvider");
  return value;
}

/** Also works for public dialogs outside the game provider. */
export function useOverlayLock(open: boolean) {
  const register = useContext(Ctx)?.registerOverlay;
  useEffect(() => {
    if (open && register) return register();
  }, [open, register]);
}
