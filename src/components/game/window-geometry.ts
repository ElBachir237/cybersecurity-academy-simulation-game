import type { WindowLayout } from "@/game/workspace";

export interface WorkspaceBounds { width: number; height: number }
export interface WindowRect { x: number; y: number; width: number; height: number }
export const MIN_WINDOW_WIDTH = 460;
export const MIN_WINDOW_HEIGHT = 320;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

/** Project saved desktop geometry into the current viewport, without overwriting it. */
export function windowRect(layout: WindowLayout, bounds: WorkspaceBounds) {
  const compact = bounds.width < 680 || bounds.height < 410;
  const expanded = compact || layout.maximized;
  const margin = bounds.width < 950 ? 0 : 24;
  const width = expanded ? bounds.width : clamp(layout.width ?? Math.min(1120, bounds.width - margin), Math.min(MIN_WINDOW_WIDTH, bounds.width), bounds.width);
  const height = expanded ? bounds.height : clamp(layout.height ?? Math.min(720, bounds.height - margin), Math.min(MIN_WINDOW_HEIGHT, bounds.height), bounds.height);
  const x = expanded ? 0 : clamp(layout.x ?? (bounds.width - width) / 2, 0, bounds.width - width);
  const y = expanded ? 0 : clamp(layout.y ?? (bounds.height - height) / 2, 0, bounds.height - height);
  return { x, y, width, height, compact, expanded };
}

export function resizedLayout(rect: WindowRect, dx: number, dy: number, bounds: WorkspaceBounds): WindowLayout {
  return {
    x: rect.x, y: rect.y, maximized: false,
    width: clamp(rect.width + dx, Math.min(MIN_WINDOW_WIDTH, bounds.width - rect.x), bounds.width - rect.x),
    height: clamp(rect.height + dy, Math.min(MIN_WINDOW_HEIGHT, bounds.height - rect.y), bounds.height - rect.y),
  };
}
