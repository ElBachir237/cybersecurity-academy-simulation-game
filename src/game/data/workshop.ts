// Atelier architecture — rack isolé (LAB-*), pas le siège HQ.
// Palier 1 (ch. 7) : IDs canoniques LAB-FW / LAB-SW / LAB-WEB / LAB-PC / LAB-AP.
// Bac à sable GNS : plusieurs instances, MikroTik / UDM / caméras, déplacement.
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

export const CANVAS_W = 1100;
export const CANVAS_H = 620;

export type WorkshopKind =
  | "pfsense"
  | "switch"
  | "server"
  | "pc"
  | "ap"
  | "mikrotik"
  | "unifi_gw"
  | "camera";

export const WORKSHOP_CATALOG: WorkshopKind[] = [
  "pfsense",
  "mikrotik",
  "unifi_gw",
  "switch",
  "server",
  "pc",
  "ap",
  "camera",
];

export const TIER1_KINDS: WorkshopKind[] = ["pfsense", "switch", "server", "pc", "ap"];

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
  mikrotik: "LAB-MT",
  unifi_gw: "LAB-UDM",
  camera: "LAB-CAM",
};

const KIND_LAYOUT: Record<WorkshopKind, { x: number; y: number }> = {
  pfsense: { x: 400, y: 80 },
  switch: { x: 400, y: 230 },
  server: { x: 220, y: 400 },
  pc: { x: 580, y: 400 },
  ap: { x: 760, y: 230 },
  mikrotik: { x: 160, y: 80 },
  unifi_gw: { x: 640, y: 80 },
  camera: { x: 920, y: 400 },
};

export function isWorkshopKind(value: unknown): value is WorkshopKind {
  return typeof value === "string" && value in WORKSHOP_KIND_IDS;
}

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

function kindLabel(kind: WorkshopKind, id: string): string {
  if (kind === "pfsense") return `${id} — pfSense (atelier)`;
  if (kind === "switch") return `${id} — Switch L2 (atelier)`;
  if (kind === "server") return `${id} — Serveur web (atelier)`;
  if (kind === "ap") return `${id} — UniFi AP (atelier)`;
  if (kind === "mikrotik") return `${id} — MikroTik (atelier)`;
  if (kind === "unifi_gw") return `${id} — UniFi Dream Machine (atelier)`;
  if (kind === "camera") return `${id} — Caméra (atelier)`;
  return `${id} — Poste de test (atelier)`;
}

function makeHost(kind: WorkshopKind, id: string): HostRuntime {
  const label = kindLabel(kind, id);
  const room = "Atelier architecture";
  if (kind === "pfsense") {
    return {
      id,
      label,
      os: "pfSense 2.7.2",
      room,
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
      label,
      os: "HP ProCurve (L2)",
      room,
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
      label,
      os: "Debian 12",
      room,
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
      label,
      os: "UniFi AP",
      room,
      ifaces: {
        eth0: { state: "up", dhcp: false },
      },
      dns: [],
      services: {},
      wifiAp: { ssid: "HORIZON-LAB", vlan: 10, enabled: true },
      logs: ["Sep 12 lab: AP waiting for uplink"],
    };
  }
  if (kind === "mikrotik") {
    return {
      id,
      label,
      os: "MikroTik RouterOS 7.14",
      room,
      ifaces: {
        ether1: { state: "up", dhcp: false },
        ether2: { state: "up", dhcp: false },
      },
      dns: [],
      services: {},
      routes: [],
      nat: [],
      logs: ["Sep 12 lab: RouterOS factory default"],
    };
  }
  if (kind === "unifi_gw") {
    return {
      id,
      label,
      os: "UniFi Dream Machine",
      room,
      ifaces: {
        wan: { state: "up", dhcp: false },
        lan: { state: "up", dhcp: false },
      },
      dns: [],
      services: {},
      guestIsolation: false,
      logs: ["Sep 12 lab: UDM factory default"],
    };
  }
  if (kind === "camera") {
    return {
      id,
      label,
      os: "Axis Camera (simulation)",
      room,
      ifaces: {
        eth0: { state: "up", dhcp: false },
      },
      dns: [],
      services: { rtsp: "active" },
      logs: ["Sep 12 lab: camera waiting for VLAN"],
    };
  }
  return {
    id,
    label,
    os: "Ubuntu 22.04 LTS",
    room,
    ifaces: {
      eth0: { state: "up", dhcp: false },
    },
    dns: [LAB_WEB_IP],
    services: { "systemd-networkd": "active", "systemd-resolved": "active" },
    logs: ["Sep 12 lab: test PC unaddressed"],
  };
}

function idTaken(world: GameWorld, id: string): boolean {
  const ws = ensureWorkshop(world);
  return !!world.hosts[id] || ws.nodes.some((n) => n.id === id);
}

function nextWorkshopId(world: GameWorld, kind: WorkshopKind): string {
  const canonical = WORKSHOP_KIND_IDS[kind];
  if (!idTaken(world, canonical)) return canonical;
  let i = 2;
  while (idTaken(world, `${canonical}-${i}`)) i += 1;
  return `${canonical}-${i}`;
}

function clampPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(48, Math.min(CANVAS_W - 48, Math.round(x))),
    y: Math.max(40, Math.min(CANVAS_H - 40, Math.round(y))),
  };
}

function defaultPos(ws: WorkshopState, kind: WorkshopKind): { x: number; y: number } {
  const base = KIND_LAYOUT[kind];
  const n = ws.nodes.filter((node) => node.kind === kind).length;
  return clampPos(base.x + n * 44, base.y + n * 32);
}

export function placeWorkshopDevice(
  world: GameWorld,
  kind: WorkshopKind,
  pos?: { x: number; y: number }
): { ok: boolean; id?: string; reason?: string } {
  const ws = ensureWorkshop(world);
  const id = nextWorkshopId(world, kind);
  const layout = pos ? clampPos(pos.x, pos.y) : defaultPos(ws, kind);
  world.hosts[id] = makeHost(kind, id);
  ws.nodes = [...ws.nodes, { id, kind, x: layout.x, y: layout.y }];
  return { ok: true, id };
}

export function moveWorkshopDevice(world: GameWorld, id: string, x: number, y: number): void {
  if (!isLabHost(id)) return;
  const ws = ensureWorkshop(world);
  const pos = clampPos(x, y);
  ws.nodes = ws.nodes.map((n) => (n.id === id ? { ...n, x: pos.x, y: pos.y } : n));
}

export function removeWorkshopDevice(world: GameWorld, id: string): void {
  if (!isLabHost(id)) return;
  delete world.hosts[id];
  const ws = ensureWorkshop(world);
  ws.nodes = ws.nodes.filter((n) => n.id !== id);
  ws.links = ws.links.filter(([a, b]) => a !== id && b !== id);
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
  for (const kind of TIER1_KINDS) {
    const id = WORKSHOP_KIND_IDS[kind];
    if (!world.hosts[id]) placeWorkshopDevice(world, kind);
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
    const kind = payload?.kind;
    if (!isWorkshopKind(kind)) return;
    const x = Number(payload?.x);
    const y = Number(payload?.y);
    const pos = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
    placeWorkshopDevice(state.world, kind, pos);
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
    return;
  }
  if (action === "workshop-move") {
    const id = String(payload?.id ?? "");
    const x = Number(payload?.x);
    const y = Number(payload?.y);
    if (id && Number.isFinite(x) && Number.isFinite(y)) moveWorkshopDevice(state.world, id, x, y);
    return;
  }
  if (action === "workshop-remove") {
    const id = String(payload?.id ?? "");
    if (id) removeWorkshopDevice(state.world, id);
    return;
  }
  if (action === "workshop-clear") {
    if (state.activeMissionId?.startsWith("e5_")) return;
    clearWorkshop(state.world);
  }
}
