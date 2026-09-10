// Chapter 11 — DFIR: text artifacts, timeline, scope. No disk image, no binary.
import type { GameState, GameWorld } from "../types";
import { EDR_HOST, injectBeaconLogs } from "./defend";

export const EVIDENCE_DIR = "/opt/horizon/evidence";
export const TIMELINE_PATH = "/opt/horizon/evidence/paul.timeline";
export const AUTH_PATH = "/opt/horizon/evidence/paul.auth";
export const EVIDENCE_HASH =
  "c8d1e4f70a2b3958671c0d4e9f2a5b8c3d6e1f4a7b0c2d5e8f1a4b7c0d3e6f9a";

const FORENSIC_LOGS = [
  "Sep 12 14:58:01 pc-paul mail: opened message from it-security@horiz0n.corp",
  "Sep 12 14:58:22 pc-paul edr: url click horiz0n (initial access)",
  "Sep 12 14:59:04 pc-paul edr: dropper staged horizon-update.exe parent explorer",
];

export const TIMELINE_TEXT = [
  "HORIZON-DFIR — timeline PC-PAUL (texte, pas une image disque).",
  "14:58  initial access: click mail it-security@horiz0n.corp",
  "14:59  dropper horizon-update.exe (parent explorer)",
  "15:02  unknown hash queued to sandbox",
  "15:03  C2 203.0.113.88:443 denied by policy",
  "Scope: PC-PAUL only. PC-MARIE not in chain. COMP-01 backup is noise.",
  "Integrity sha256: " + EVIDENCE_HASH,
  "",
].join("\n");

export const AUTH_TEXT = [
  "HORIZON-DFIR — extrait auth PC-PAUL",
  "Sep 12 14:58:01 mail opened horiz0n",
  "Sep 12 14:58:22 initial access url click",
  "Sep 12 14:59:04 horizon-update.exe parent explorer",
  "",
].join("\n");

export function isEvidencePath(path: string): boolean {
  const p = path.replace(/\/+$/, "");
  return p === TIMELINE_PATH || p === AUTH_PATH || p.endsWith("/paul.timeline") || p.endsWith("/paul.auth");
}

export function injectForensicLogs(world: GameWorld): void {
  injectBeaconLogs(world);
  const host = world.hosts[EDR_HOST];
  if (!host) return;
  for (const line of FORENSIC_LOGS) {
    if (!host.logs.includes(line)) host.logs.push(line);
  }
}

export function clearEvidence(world: GameWorld): void {
  world.evidence = [];
}

export function paulAcquired(state: GameState): boolean {
  return (state.world.evidence ?? []).some((h) => h.toUpperCase() === EDR_HOST);
}

export function overscope(state: GameState): boolean {
  return (state.world.evidence ?? []).some((h) => h.toUpperCase() !== EDR_HOST);
}

export function triedWipe(e: { type: string; argv?: string[] }): boolean {
  if (e.type !== "cmd") return false;
  const c = (e.argv?.[0] ?? "").toLowerCase().replace(/^\.\//, "");
  return ["rm", "shred", "mkfs", "wipe", "dd", "format"].includes(c);
}

export function acquireHost(state: GameState, id: string): void {
  if (!state.world.evidence) state.world.evidence = [];
  const key = id.toUpperCase();
  if (!state.world.evidence.some((h) => h.toUpperCase() === key)) state.world.evidence.push(key);
}
