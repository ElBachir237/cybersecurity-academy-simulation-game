// SOC L2 / IR — sandbox, IOC, isolation hôte. Défense uniquement, pas d'exécutable.
import type { GameState, GameWorld } from "../types";
import { FINANCE_CIDR, firewallAllows } from "./world";
import type { SocAlertKind } from "./soc";

export const SAMPLE_HASH =
  "a4f3c8e19b2d7e6a1c0f5d8b3e7a9124c6d0e8f1a2b3c4d5e6f708192a3b4c5d";
export const SAMPLE_PATH = "/opt/horizon/sandbox/sample.quarantine";
export const EDR_HOST = "PC-PAUL";
export const EDR_ALERT_ID = "SOC-9001";
export const IR_PAY_ID = "FW-IR-PAY";
export const MARIE_IP = "192.168.20.45";
export const DNS_IP = "10.0.0.10";

const BEACON_LOGS = [
  "Sep 12 15:02:11 pc-paul edr: unknown hash queued to sandbox",
  "Sep 12 15:02:18 pc-paul edr: process horizon-update.exe parent explorer",
  "Sep 12 15:03:02 pc-paul systemd[1]: outbound 203.0.113.88:443 denied by policy (beacon)",
  "Sep 12 15:03:09 pc-paul edr: sandbox extract: update.horiz0n.example",
];

export const SAMPLE_TEXT = [
  "HORIZON-SANDBOX — extrait texte (pas un binaire).",
  "Quarantine-Id: Q-9001",
  "sha256: " + SAMPLE_HASH,
  "strings: beacon  update.horiz0n.example  C2 203.0.113.88",
  "Action: ne pas exécuter. Isoler l'hôte, poser l'IOC.",
  "",
].join("\n");

export const SAMPLE_STRINGS = [
  "HORIZON-SANDBOX strings (text extract, not an executable)",
  "beacon",
  "update.horiz0n.example",
  "C2: 203.0.113.88",
  "quarantine: do-not-run",
];

export function isSamplePath(path: string): boolean {
  const p = path.replace(/\/+$/, "");
  return p === SAMPLE_PATH || p.endsWith("/sample.quarantine");
}

export function injectBeaconLogs(world: GameWorld): void {
  const host = world.hosts[EDR_HOST];
  if (!host) return;
  for (const line of BEACON_LOGS) {
    if (!host.logs.includes(line)) host.logs.push(line);
  }
}

export function seedEdrQueue(world: GameWorld, at: number): void {
  const kind: SocAlertKind = "edr";
  world.socAlerts = [
    {
      id: EDR_ALERT_ID,
      severity: "high",
      titleKey: "socAlerts.edr.title",
      bodyKey: "socAlerts.edr.body",
      hostId: EDR_HOST,
      rule: "EDR-UNKNOWN-HASH",
      status: "open",
      truePositive: true,
      kind,
      createdAt: at,
    },
  ];
}

export function hostIsolated(state: GameState, id: string): boolean {
  return !!state.world.hosts[id]?.isolated;
}

export function iocListed(state: GameState, hash = SAMPLE_HASH): boolean {
  return (state.world.iocs ?? []).some(
    (h) => h.toLowerCase() === hash.toLowerCase() || hash.toLowerCase().startsWith(h.toLowerCase())
  );
}

export function financeAlive(state: GameState): boolean {
  const marie = state.world.hosts["PC-MARIE"];
  if (!marie || marie.isolated) return false;
  const ip = marie.ifaces.eth0?.ip ?? MARIE_IP;
  if (marie.ifaces.eth0?.state !== "up") return false;
  return firewallAllows(ip, DNS_IP, state);
}

export function payrollBlocked(state: GameState): boolean {
  return (state.world.fwRules ?? []).some((r) => r.id === IR_PAY_ID);
}

export function injectPayrollBlock(world: GameWorld): void {
  const rules = world.fwRules ?? [];
  if (rules.some((r) => r.id === IR_PAY_ID)) return;
  world.fwRules = [
    ...rules,
    {
      id: IR_PAY_ID,
      action: "deny",
      src: FINANCE_CIDR,
      dst: "0.0.0.0/0",
      proto: "any",
      comment: "panic contain — kills payroll",
    },
  ];
}

export function clearHostIsolation(world: GameWorld, id: string): void {
  const h = world.hosts[id];
  if (h) h.isolated = false;
}
