import type { AppId } from "./types";

// Additive UI save format: game progression keeps its existing version/key.
export const WORKSPACE_VERSION = 1;
export const MAX_TERMINAL_INPUT = 300;
export const MAX_TERMINAL_BLOCKS = 80;
export const APP_IDS: readonly AppId[] = ["mail", "chat", "terminal", "browser", "network", "soc", "files", "tickets", "academy", "skills", "portfolio"];
export const CHAT_CHANNELS = ["itsupport", "soc", "general"] as const;

export interface WindowLayout {
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  maximized: boolean;
}
export interface TerminalBlock {
  id: string;
  command: string;
  output: string[];
  note?: boolean;
}
export interface TerminalSession {
  draft: string;
  blocks: TerminalBlock[];
}
export interface WorkspaceState {
  version: 1;
  windows: Partial<Record<AppId, WindowLayout>>;
  terminal: { hostId: string; sessions: Record<string, TerminalSession> };
  chat: { channel: string; drafts: Record<string, string> };
  editorDraft: { hostId: string; path: string; content: string } | null;
}

export function defaultWindowLayout(): WindowLayout {
  return { x: null, y: null, width: null, height: null, maximized: false };
}
export function createWorkspace(): WorkspaceState {
  return {
    version: WORKSPACE_VERSION,
    windows: {},
    terminal: { hostId: "WS-001", sessions: {} },
    chat: { channel: "itsupport", drafts: {} },
    editorDraft: null,
  };
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const coordinate = (value: unknown, min = 0): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(8192, Math.max(min, value)) : null;

export function normalizeWindowLayout(value: unknown): WindowLayout {
  const item = record(value);
  return {
    x: coordinate(item.x), y: coordinate(item.y),
    width: coordinate(item.width, 320), height: coordinate(item.height, 260),
    maximized: item.maximized === true,
  };
}

/** Bound scrollback independently of mission history and demonstrated skills. */
export function trimTerminalBlocks(blocks: TerminalBlock[]): TerminalBlock[] {
  const result: TerminalBlock[] = [];
  let remaining = 100_000;
  for (const block of blocks.slice(-MAX_TERMINAL_BLOCKS).reverse()) {
    const output = block.output.slice(0, 100).map((line) => line.slice(0, 2000));
    const chars = output.join("\n").length + block.command.length;
    if (chars > remaining && result.length) break;
    result.unshift({ ...block, output });
    remaining -= chars;
  }
  return result;
}

/** Validate only the additive workspace; never rewrite missions or world state. */
export function restoreWorkspace(value: unknown, hostIds: string[]): WorkspaceState {
  const fresh = createWorkspace();
  const raw = record(value);
  const windows = record(raw.windows);
  for (const app of APP_IDS) if (windows[app]) fresh.windows[app] = normalizeWindowLayout(windows[app]);
  const terminal = record(raw.terminal);
  if (typeof terminal.hostId === "string" && hostIds.includes(terminal.hostId)) fresh.terminal.hostId = terminal.hostId;
  else fresh.terminal.hostId = hostIds.includes("WS-001") ? "WS-001" : hostIds[0] ?? "WS-001";
  const sessions = record(terminal.sessions);
  for (const hostId of hostIds) {
    if (!sessions[hostId]) continue;
    const session = record(sessions[hostId]);
    const blocks: TerminalBlock[] = [];
    for (const [index, value] of (Array.isArray(session.blocks) ? session.blocks.slice(-MAX_TERMINAL_BLOCKS) : []).entries()) {
      const item = record(value);
      if (typeof item.command !== "string" || !Array.isArray(item.output)) continue;
      blocks.push({
        id: typeof item.id === "string" ? item.id.slice(0, 100) : `restored-${hostId}-${index}`,
        command: item.command.slice(0, MAX_TERMINAL_INPUT),
        output: item.output.filter((line): line is string => typeof line === "string"),
        note: item.note === true,
      });
    }
    fresh.terminal.sessions[hostId] = {
      draft: typeof session.draft === "string" ? session.draft.slice(0, MAX_TERMINAL_INPUT) : "",
      blocks: trimTerminalBlocks(blocks),
    };
  }
  const chat = record(raw.chat);
  if (typeof chat.channel === "string" && CHAT_CHANNELS.some((id) => id === chat.channel)) fresh.chat.channel = chat.channel;
  const drafts = record(chat.drafts);
  for (const channel of CHAT_CHANNELS) if (typeof drafts[channel] === "string") fresh.chat.drafts[channel] = drafts[channel].slice(0, 500);
  const editor = record(raw.editorDraft);
  if (typeof editor.hostId === "string" && hostIds.includes(editor.hostId) && typeof editor.path === "string" && editor.path.startsWith("/") && editor.path.length <= 512 && typeof editor.content === "string") {
    fresh.editorDraft = { hostId: editor.hostId, path: editor.path, content: editor.content.slice(0, 24000) };
  }
  return fresh;
}
