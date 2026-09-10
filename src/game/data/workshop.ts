// Atelier architecture palier 1 — rack isolé (LAB-*), pas le siège HQ.
import type { GameState, GameWorld, HostRuntime } from "../types";

export const LAB_FW = "LAB-FW";
export const LAB_SW = "LAB-SW";
export const LAB_WEB = "LAB-WEB";
export const LAB_PC = "LAB-PC";
export const LAB_AP = "LAB-AP";
export const LAB_SITE = "lab.horizon.local";
export const LAB_NET = "10.20.0.0/24";
export const LAB_GW_IP = "10.20.0.1";
export const LAB_WEB_IP = "10.20.0.20";
export const LAB_PC_IP = "10.20.0.24";

export type WorkshopKind = "pfsense" | "switch" | "server" | "pc" | "ap";

export interface WorkshopNode {
  id: string;
  kind: WorkshopKind;
  x: number;
  y: number;
}

export interface WorkshopState {
  nodes: WorkshopNode[];
  links: [string, string][];
}

export const WORKSHOP_KIND_IDS: Record<WorkshopKind, string> = {
  pfsense: LAB_FW,
  switch: LAB_SW,
  server: LAB_WEB,
  pc: LAB_PC,
  ap: LAB_AP,
};

const KIND_LAYOUT: Record<WorkshopKind, { x: number; y: number }> = {
  pfsense: { x: 400, y: 70 },
  switch: { x: 400, y: 190 },
  server: { x: 220, y: 310 },
  pc: { x: 580, y: 310 },
  ap: { x: 720, y: 190 },
};

export function emptyWorkshop(): WorkshopState {
  return { nodes: [], links: [] };
}

export function ensureWorkshop(world: GameWorld): WorkshopState {
  if (!world.workshop) world.workshop = emptyWorkshop();
  return world.workshop;
}

export function isLabHost(id: string): boolean {
  return id.startsWith("LAB-");
}

export function findHostIdByIp(ip: string, state: GameState): string | undefined {
  for (const [id, h] of Object.entries(state.world.hosts)) {
    for (const iface of Object.values(h.ifaces)) {
      if (iface.ip === ip) return id;
    }
  }
  return undefined;
}

export function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function hasLink(ws: WorkshopState, a: string, b: string): boolean {
  const k = linkKey(a, b);
  return ws.links.some(([x, y]) => linkKey(x, y) === k);
}

export function workshopConnected(a: string, b: string, state: GameState): boolean {
  if (a === b) return true;
  const links = state.world.workshop?.links ?? [];
  const adj = new Map<string, string[]>();
  for (const [x, y] of links) {
    adj.set(x, [...(adj.get(x) ?? []), y]);
    adj.set(y, [...(adj.get(y) ?? []), x]);
  }
  const seen = new Set<string>([a]);
  const q = [a];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === b) return true;
    for (const n of adj.get(cur) ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return false;
}

function makeHost(kind: WorkshopKind): HostRuntime {
  const id = WORKSHOP_KIND_IDS[kind];
  if (kind === "pfsense") {
    return {
      id,
      label: "LAB-FW — pfSense (atelier)",
      os: "pfSense 2.7.2",
      room: "Atelier architecture",
      ifaces: {
        em0: { state: "up", dhcp: false },
        em1: { state: "up", dhcp: false },
      },
      dns: [],
      services: { filter: "active" },
      logs: ["Sep 12 lab: pfSense factory default"],
    };
  }
  if (kind === "switch") {
    return {
      id,
      label: "LAB-SW — Switch L2 (atelier)",
      os: "HP ProCurve (L2)",
      room: "Atelier architecture",
      ifaces: {
        vlan: { state: "up", dhcp: false },
      },
      dns: [],
      services: {},
      logs: ["Sep 12 lab: switch empty rack"],
    };
  }
  if (kind === "server") {
    return {
      id,
      label: "LAB-WEB — Serveur web (atelier)",
      os: "Debian 12",
      room: "Atelier architecture",
      ifaces: {
        eth0: { state: "up", dhcp: false },
      },
      dns: [LAB_GW_IP],
      services: { nginx: "active", named: "active" },
      logs: ["Sep 12 lab: nginx idle, waiting for address"],
    };
  }
  if (kind === "ap") {
    return {
      id,
      label: "LAB-AP — UniFi AP (atelier)",
      os: "UniFi AP",
      room: "Atelier architecture",
      ifaces: {
        eth0: { state: "up", dhcp: false },
      },
      dns: [],
      services: {},
      wifiAp: { ssid: "HORIZON-LAB", vlan: 10, enabled: true },
      logs: ["Sep 12 lab: AP waiting for uplink"],
    };
  }
  return {
    id,
    label: "LAB-PC — Poste de test (atelier)",
    os: "Ubuntu 22.04 LTS",
    room: "Atelier architecture",
    ifaces: {
      eth0: { state: "up", dhcp: false },
    },
    dns: [LAB_WEB_IP],
    services: { "systemd-networkd": "active", "systemd-resolved": "active" },
    logs: ["Sep 12 lab: test PC unaddressed"],
  };
}

export function placeWorkshopDevice(world: GameWorld, kind: WorkshopKind): { ok: boolean; id?: string; reason?: string } {
  const ws = ensureWorkshop(world);
  const id = WORKSHOP_KIND_IDS[kind];
  if (ws.nodes.some((n) => n.id === id) || world.hosts[id]) {
    return { ok: false, id, reason: "already" };
  }
  const layout = KIND_LAYOUT[kind];
  world.hosts[id] = makeHost(kind);
  ws.nodes = [...ws.nodes, { id, kind, x: layout.x, y: layout.y }];
  return { ok: true, id };
}

export function cableWorkshop(world: GameWorld, a: string, b: string): { ok: boolean; reason?: string } {
  const ws = ensureWorkshop(world);
  if (a === b) return { ok: false, reason: "self" };
  if (!world.hosts[a] || !world.hosts[b]) return { ok: false, reason: "missing" };
  if (hasLink(ws, a, b)) return { ok: false, reason: "exists" };
  ws.links = [...ws.links, a < b ? [a, b] : [b, a]];
  return { ok: true };
}

export function uncableWorkshop(world: GameWorld, a: string, b: string): void {
  const ws = ensureWorkshop(world);
  const k = linkKey(a, b);
  ws.links = ws.links.filter(([x, y]) => linkKey(x, y) !== k);
}

export function clearWorkshop(world: GameWorld): void {
  for (const id of Object.keys(world.hosts)) {
    if (isLabHost(id)) delete world.hosts[id];
  }
  world.workshop = emptyWorkshop();
}

const REQUIRED_CABLES: [string, string][] = [
  [LAB_FW, LAB_SW],
  [LAB_SW, LAB_WEB],
  [LAB_SW, LAB_PC],
  [LAB_SW, LAB_AP],
];

export function requiredCablesPresent(state: GameState): boolean {
  const ws = state.world.workshop;
  if (!ws) return false;
  return REQUIRED_CABLES.every(([a, b]) => hasLink(ws, a, b));
}

export function rackPlaced(state: GameState): boolean {
  const ids = [LAB_FW, LAB_SW, LAB_WEB, LAB_PC, LAB_AP];
  return ids.every((id) => !!state.world.hosts[id]);
}

export function applyLabAddressing(world: GameWorld): void {
  const fw = world.hosts[LAB_FW];
  if (fw?.ifaces.em1) {
    fw.ifaces.em1 = { state: "up", dhcp: false, ip: LAB_GW_IP, cidr: 24 };
  }
  const web = world.hosts[LAB_WEB];
  if (web?.ifaces.eth0) {
    web.ifaces.eth0 = { state: "up", dhcp: false, ip: LAB_WEB_IP, cidr: 24, gw: LAB_GW_IP };
    web.dns = [LAB_WEB_IP];
  }
  const pc = world.hosts[LAB_PC];
  if (pc?.ifaces.eth0) {
    pc.ifaces.eth0 = { state: "up", dhcp: false, ip: LAB_PC_IP, cidr: 24, gw: LAB_GW_IP };
    pc.dns = [LAB_WEB_IP];
  }
}

export function stripLabAddressing(world: GameWorld): void {
  const fw = world.hosts[LAB_FW];
  if (fw?.ifaces.em1) fw.ifaces.em1 = { state: "up", dhcp: false };
  const web = world.hosts[LAB_WEB];
  if (web?.ifaces.eth0) web.ifaces.eth0 = { state: "up", dhcp: false };
  const pc = world.hosts[LAB_PC];
  if (pc?.ifaces.eth0) pc.ifaces.eth0 = { state: "up", dhcp: false };
}

export function ensureBuiltRack(world: GameWorld): void {
  for (const kind of ["pfsense", "switch", "server", "pc", "ap"] as WorkshopKind[]) {
    placeWorkshopDevice(world, kind);
  }
  for (const [a, b] of REQUIRED_CABLES) {
    cableWorkshop(world, a, b);
  }
}

export function labSiteReachable(state: GameState): boolean {
  const pc = state.world.hosts[LAB_PC];
  const web = state.world.hosts[LAB_WEB];
  if (!pc || !web) return false;
  if (web.ifaces.eth0?.ip !== LAB_WEB_IP) return false;
  if (web.services.nginx !== "active") return false;
  if (state.world.dns?.[LAB_SITE] !== LAB_WEB_IP) return false;
  if (state.world.vhosts?.[LAB_SITE]?.enabled !== true) return false;
  return workshopConnected(LAB_PC, LAB_WEB, state);
}

export function applyWorkshopAction(
  state: GameState,
  action: string,
  payload?: Record<string, unknown>
): void {
  if (action === "workshop-place") {
    const kind = payload?.kind as WorkshopKind | undefined;
    if (kind && kind in WORKSHOP_KIND_IDS) placeWorkshopDevice(state.world, kind);
    return;
  }
  if (action === "workshop-cable") {
    const a = String(payload?.a ?? "");
    const b = String(payload?.b ?? "");
    if (a && b) cableWorkshop(state.world, a, b);
    return;
  }
  if (action === "workshop-uncable") {
    const a = String(payload?.a ?? "");
    const b = String(payload?.b ?? "");
    if (a && b) uncableWorkshop(state.world, a, b);
  }
}
