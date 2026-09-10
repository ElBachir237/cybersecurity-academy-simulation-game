"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useGame } from "./context";
import { APP_ICONS, Icon } from "./ui";
import type { AppId } from "@/game/types";
import { defaultWindowLayout, type WindowLayout } from "@/game/workspace";
import { clamp, resizedLayout, windowRect, type WindowRect, type WorkspaceBounds } from "./window-geometry";

export type { WorkspaceBounds } from "./window-geometry";
const DEFAULT_LAYOUT = defaultWindowLayout();
const editableSelector = 'input:not([type="range"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]';
interface Gesture {
  kind: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  rect: WindowRect;
  initial: WindowLayout;
  latest: WindowLayout;
}

export default function WindowFrame({ app, active, bounds, children }: {
  app: AppId;
  active: boolean;
  bounds: WorkspaceBounds;
  children: ReactNode;
}) {
  const { engine, state, t, overlayCount } = useGame();
  const saved = state.workspace.windows[app] ?? DEFAULT_LAYOUT;
  const [preview, setPreview] = useState<WindowLayout | null>(null);
  const [gestureKind, setGestureKind] = useState<Gesture["kind"] | null>(null);
  const [focusRequest, requestFocus] = useState(0);
  const frameRef = useRef<HTMLElement>(null);
  const lastField = useRef<HTMLElement | null>(null);
  const selection = useRef<{ field: HTMLInputElement | HTMLTextAreaElement; start: number; end: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const geometry = windowRect(preview ?? saved, bounds);
  const { x, y, width, height, compact, expanded } = geometry;
  const fr = state.profile?.lang !== "en";

  useEffect(() => {
    if (!active || overlayCount > 0) return;
    const frame = requestAnimationFrame(() => {
      const root = frameRef.current;
      if (!root || root.hidden || root.inert || document.querySelector('[data-horizon-dialog]')) return;
      const current = document.activeElement;
      if (current instanceof HTMLElement && root.contains(current) && current.matches(editableSelector)) return;
      const remembered = lastField.current;
      const target = remembered?.isConnected && root.contains(remembered) && remembered.getClientRects().length && remembered.matches(editableSelector)
        ? remembered
        : root.querySelector<HTMLElement>('[data-window-autofocus]:not([disabled])') ?? root.querySelector<HTMLElement>(editableSelector);
      target?.focus({ preventScroll: true });
      const caret = selection.current;
      if (caret && caret.field === target && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        target.setSelectionRange(caret.start, caret.end);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, overlayCount, focusRequest]);

  const toggleSize = () => {
    engine.setWindowLayout(app, { maximized: !saved.maximized });
    requestFocus((value) => value + 1);
  };
  const reset = () => {
    engine.resetWindowLayout(app);
    requestFocus((value) => value + 1);
  };

  const startGesture = (event: PointerEvent<HTMLElement>, kind: Gesture["kind"]) => {
    if (expanded || event.button !== 0 || !event.isPrimary) return;
    if (kind === "move" && (event.target as HTMLElement).closest("button, input, textarea, select, a")) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = {
      kind, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      rect: { x, y, width, height }, initial: saved, latest: saved,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setGestureKind(kind);
  };
  const moveGesture = (event: PointerEvent<HTMLElement>) => {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    const next = start.kind === "resize"
      ? resizedLayout(start.rect, dx, dy, bounds)
      : {
          ...start.initial,
          x: clamp(start.rect.x + dx, 0, bounds.width - start.rect.width),
          y: clamp(start.rect.y + dy, 0, bounds.height - start.rect.height),
        };
    start.latest = next;
    // Pointer motion is local. Commit once on release, never on every pixel.
    setPreview(next);
  };
  const finishGesture = (event: PointerEvent<HTMLElement>, cancel = false) => {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && start.latest !== start.initial) engine.setWindowLayout(app, start.latest);
    setPreview(null);
    setGestureKind(null);
    requestFocus((value) => value + 1);
  };

  return (
    <section
      ref={frameRef}
      id={`window-${app}`}
      role="tabpanel"
      aria-labelledby={`tab-${app}`}
      data-testid={`window-${app}`}
      data-window={app}
      data-expanded={expanded}
      className={`hz-window ${gestureKind === "move" ? "is-dragging" : gestureKind === "resize" ? "is-resizing" : ""}`}
      hidden={!active}
      inert={!active || overlayCount > 0}
      style={{ left: x, top: y, width, height }}
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.matches(editableSelector)) lastField.current = target;
      }}
      onBlurCapture={(event) => {
        const field = event.target;
        if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && field.selectionStart !== null && field.selectionEnd !== null) {
          selection.current = { field, start: field.selectionStart, end: field.selectionEnd };
        }
      }}
    >
      <div
        className="hz-window-titlebar"
        data-testid={`titlebar-${app}`}
        data-draggable={!expanded}
        onPointerDown={(event) => startGesture(event, "move")}
        onPointerMove={moveGesture}
        onPointerUp={finishGesture}
        onPointerCancel={(event) => finishGesture(event, true)}
        onLostPointerCapture={(event) => finishGesture(event, true)}
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest("button") && !compact) toggleSize();
        }}
      >
        <span className="hz-window-app-icon"><Icon name={APP_ICONS[app]} size={18} /></span>
        <div className="hz-window-heading"><h2>{t(`apps.${app}.name`)}</h2><span>{app === "terminal" ? "HORIZON SHELL" : t(`apps.${app}.sub`)}</span></div>
        <span className="hz-window-badge">{gestureKind ? <span className="hz-window-measurement">{Math.round(width)} × {Math.round(height)}</span> : <><span className="hz-live-dot" />{fr ? "Environnement simulé" : "Simulated environment"}</>}</span>
        <div className="hz-window-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={reset} data-testid={`reset-layout-${app}`} title={fr ? "Recentrer et rétablir la taille de cette fenêtre" : "Center this window and reset its size"} aria-label={fr ? "Recentrer la fenêtre" : "Center window"}><Icon name="retry" size={14} /></button>
          <button type="button" onClick={() => engine.minimizeWindow(app)} title={fr ? "Réduire dans les onglets" : "Minimize to tabs"} aria-label={fr ? "Réduire la fenêtre" : "Minimize window"}><Icon name="minimize" size={16} /></button>
          {!compact && <button type="button" onClick={toggleSize} title={saved.maximized ? (fr ? "Rétablir la taille" : "Restore size") : (fr ? "Agrandir l’espace de travail" : "Expand workspace")} aria-label={saved.maximized ? (fr ? "Rétablir la fenêtre" : "Restore window") : (fr ? "Agrandir la fenêtre" : "Maximize window")} aria-pressed={saved.maximized} data-testid={`maximize-${app}`}><Icon name={saved.maximized ? "restore" : "maximize"} size={15} /></button>}
          <button type="button" className="hz-window-close" onClick={() => engine.closeWindow(app)} title={t("common.close")} aria-label={`${t("common.close")} ${t(`apps.${app}.name`)}`}><Icon name="x" size={17} /></button>
        </div>
      </div>
      <div className="hz-app-content">{children}</div>
      {!expanded && <>
        <button
          type="button"
          className="hz-window-resize"
          data-testid={`resize-${app}`}
          aria-label={`${fr ? "Redimensionner" : "Resize"} ${t(`apps.${app}.name`)}`}
          aria-describedby={`resize-instructions-${app}`}
          title={fr ? "Glisser pour redimensionner · Flèches au clavier" : "Drag to resize · Arrow keys supported"}
          onPointerDown={(event) => startGesture(event, "resize")}
          onPointerMove={moveGesture}
          onPointerUp={finishGesture}
          onPointerCancel={(event) => finishGesture(event, true)}
          onLostPointerCapture={(event) => finishGesture(event, true)}
          onKeyDown={(event) => {
            const amount = event.shiftKey ? 48 : 16;
            const dx = event.key === "ArrowRight" ? amount : event.key === "ArrowLeft" ? -amount : 0;
            const dy = event.key === "ArrowDown" ? amount : event.key === "ArrowUp" ? -amount : 0;
            if (dx || dy) { event.preventDefault(); engine.setWindowLayout(app, resizedLayout({ x, y, width, height }, dx, dy, bounds)); }
            if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); requestFocus((value) => value + 1); }
          }}
        ><svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M8 13l5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></button>
        <span className="sr-only" id={`resize-instructions-${app}`}>{fr ? "Utilisez les flèches pour régler la taille. Entrée revient à la saisie. Recentrer rétablit la disposition." : "Use arrow keys to resize. Enter returns to the input. Center resets the layout."}</span>
      </>}
    </section>
  );
}
