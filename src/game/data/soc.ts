// SOC L1 — file d'alertes SIEM simulée. Triage défense, pas d'exploit.
import type { GameState, GameWorld, Severity } from "../types";

export type SocAlertStatus = "open" | "fp" | "escalated";
export type SocAlertKind = "noise" | "brute" | "phish";

export interface SocAlert {
  id: string;
  severity: Severity;
  titleKey: string;
  bodyKey: string;
  hostId?: string;
  rule: string;
  status: SocAlertStatus;
  truePositive: boolean;
  kind: SocAlertKind;
  createdAt: number;
}

export const BRUTE_ALERT_ID = "SOC-8009";
export const PHISH_ALERT_ID = "SOC-8101";
export const BRUTE_HOST = "SRV-WEB";

type AlertSeed = Omit<SocAlert, "status" | "createdAt">;

const LAB_QUEUE: AlertSeed[] = [
  {
    id: "SOC-8001",
    severity: "low",
    titleKey: "socAlerts.backup.title",
    bodyKey: "socAlerts.backup.body",
    hostId: "COMP-01",
    rule: "BACKUP-WARN",
    truePositive: false,
    kind: "noise",
  },
  {
    id: "SOC-8002",
    severity: "info",
    titleKey: "socAlerts.dhcp.title",
    bodyKey: "socAlerts.dhcp.body",
    hostId: "PC-MARIE",
    rule: "DHCP-RENEW",
    truePositive: false,
    kind: "noise",
  },
  {
    id: "SOC-8003",
    severity: "low",
    titleKey: "socAlerts.scan.title",
    bodyKey: "socAlerts.scan.body",
    hostId: "FW-PFS",
    rule: "SCAN-SCHED",
    truePositive: false,
    kind: "noise",
  },
  {
    id: "SOC-8004",
    severity: "info",
    titleKey: "socAlerts.printer.title",
    bodyKey: "socAlerts.printer.body",
    hostId: "PRN-01",
    rule: "IT-PRINTER",
    truePositive: false,
    kind: "noise",
  },
  {
    id: "SOC-8005",
    severity: "info",
    titleKey: "socAlerts.nginx.title",
    bodyKey: "socAlerts.nginx.body",
    hostId: "SRV-WEB",
    rule: "SVC-RELOAD",
    truePositive: false,
    kind: "noise",
  },
  {
    id: "SOC-8006",
    severity: "low",
    titleKey: "socAlerts.guest.title",
    bodyKey: "socAlerts.guest.body",
    hostId: "AP-01",
    rule: "WIFI-ASSOC",
    truePositive: false,
    kind: "noise",
  },
  {
    id: "SOC-8007",
    severity: "low",
    titleKey: "socAlerts.dns.title",
    bodyKey: "socAlerts.dns.body",
    hostId: "DNS-01",
    rule: "DNS-VOLUME",
    truePositive: false,
    kind: "noise",
  },
  {
    id: "SOC-8008",
    severity: "medium",
    titleKey: "socAlerts.vpn.title",
    bodyKey: "socAlerts.vpn.body",
    hostId: "FW-PFS",
    rule: "CERT-EXPIRY",
    truePositive: false,
    kind: "noise",
  },
  {
    id: BRUTE_ALERT_ID,
    severity: "high",
    titleKey: "socAlerts.brute.title",
    bodyKey: "socAlerts.brute.body",
    hostId: BRUTE_HOST,
    rule: "SSH-BRUTE",
    truePositive: true,
    kind: "brute",
  },
  {
    id: "SOC-8010",
    severity: "low",
    titleKey: "socAlerts.bounce.title",
    bodyKey: "socAlerts.bounce.body",
    hostId: "SRV-WEB",
    rule: "MAIL-BOUNCE",
    truePositive: false,
    kind: "noise",
  },
];

const PHISH_ALERT: AlertSeed = {
  id: PHISH_ALERT_ID,
  severity: "medium",
  titleKey: "socAlerts.phish.title",
  bodyKey: "socAlerts.phish.body",
  rule: "MAIL-PHISH",
  truePositive: true,
  kind: "phish",
};

const BRUTE_LOGS = [
  "Sep 12 14:02:11 srv-web sshd[4412]: Failed password for root from 203.0.113.88 port 52811 ssh2",
  "Sep 12 14:02:14 srv-web sshd[4412]: Failed password for root from 203.0.113.88 port 52812 ssh2",
  "Sep 12 14:02:18 srv-web sshd[4413]: Failed password for invalid user admin from 203.0.113.88 port 52814 ssh2",
  "Sep 12 14:02:22 srv-web sshd[4414]: Failed password for root from 203.0.113.88 port 52818 ssh2",
  "Sep 12 14:02:27 srv-web sshd[4415]: Failed password for root from 203.0.113.88 port 52821 ssh2",
  "Sep 12 14:02:31 srv-web sshd[4416]: Failed password for invalid user ubuntu from 203.0.113.88 port 52824 ssh2",
  "Sep 12 14:04:02 srv-web sshd[4420]: Connection closed by authenticating user root 203.0.113.88 port 52821 [preauth]",
];

function materialize(seeds: AlertSeed[], at: number): SocAlert[] {
  return seeds.map((a) => ({ ...a, status: "open" as const, createdAt: at }));
}

export function emptySocAlerts(): SocAlert[] {
  return [];
}

export function ensureSocAlerts(world: GameWorld): SocAlert[] {
  if (!world.socAlerts) world.socAlerts = emptySocAlerts();
  return world.socAlerts;
}

export function seedLabQueue(world: GameWorld, at: number): void {
  world.socAlerts = materialize(LAB_QUEUE, at);
}

export function seedNoiseQueue(world: GameWorld, at: number): void {
  world.socAlerts = materialize(
    LAB_QUEUE.filter((a) => !a.truePositive),
    at
  );
}

export function seedBruteQueue(world: GameWorld, at: number): void {
  seedLabQueue(world, at);
}

export function seedPhishQueue(world: GameWorld, at: number): void {
  world.socAlerts = materialize([PHISH_ALERT], at);
}

export function injectBruteLogs(world: GameWorld): void {
  const host = world.hosts[BRUTE_HOST];
  if (!host) return;
  for (const line of BRUTE_LOGS) {
    if (!host.logs.includes(line)) host.logs.push(line);
  }
}

export function alertById(state: GameState, id: string): SocAlert | undefined {
  return (state.world.socAlerts ?? []).find((a) => a.id === id);
}

export function noiseClosedAsFp(state: GameState): boolean {
  const alerts = state.world.socAlerts ?? [];
  const noise = alerts.filter((a) => !a.truePositive);
  return noise.length > 0 && noise.every((a) => a.status === "fp");
}

export function allAlertsHandled(state: GameState): boolean {
  const alerts = state.world.socAlerts ?? [];
  return alerts.length > 0 && alerts.every((a) => a.status !== "open");
}

export function truePositiveEscalated(state: GameState, id: string): boolean {
  return alertById(state, id)?.status === "escalated";
}

export function anyNoiseEscalated(state: GameState): boolean {
  return (state.world.socAlerts ?? []).some((a) => !a.truePositive && a.status === "escalated");
}

export function phishMailReported(state: GameState): boolean {
  return state.mails.some((m) => m.phish && m.reported);
}

export function applySocAction(
  state: GameState,
  action: string,
  payload?: Record<string, unknown>
): void {
  ensureSocAlerts(state.world);
  if (action === "soc-fp" || action === "soc-escalate") {
    const id = String(payload?.id ?? "");
    const nextStatus: SocAlertStatus = action === "soc-fp" ? "fp" : "escalated";
    state.world.socAlerts = (state.world.socAlerts ?? []).map((a) => {
      if (a.id !== id) return a;
      if (a.status === "escalated") return a;
      if (a.status === "fp" && nextStatus === "fp") return a;
      return { ...a, status: nextStatus };
    });
    return;
  }
  if (action === "mail-report-phish") {
    const mailId = String(payload?.mailId ?? "");
    state.mails = state.mails.map((m) =>
      m.id === mailId && m.phish ? { ...m, reported: true } : m
    );
  }
}
