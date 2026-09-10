// ============================================================
// HORIZON CYBER ACADEMY — World data
// Hosts, DNS zone, NPCs, initial mail/chat, topology.
// The world is persistent: missions mutate host runtime state,
// tickets and NPC moods; the engine snapshots it into saves.
// ============================================================

import type { FwRule, GameState, HostRuntime, IfaceRuntime, SwitchPort } from "../types";

export const CORE_CIDR = "10.0.0.0/24";
export const FINANCE_CIDR = "192.168.20.0/24";
export const OFFICE_CIDR = "192.168.10.0/24";
export const FLOOR4_CIDR = "192.168.40.0/26";

function ipToInt(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  const n = p.map((o) => Number(o));
  if (n.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
  return (((n[0] << 24) | (n[1] << 16) | (n[2] << 8) | n[3]) >>> 0);
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [net, bitsRaw] = cidr.split("/");
  const addr = ipToInt(ip);
  const netInt = ipToInt(net ?? "");
  if (addr === null || netInt === null) return false;
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (addr & mask) === (netInt & mask);
}

function userVlan(ip: string): "10" | "20" | "30" | "40" | null {
  if (ipInCidr(ip, OFFICE_CIDR)) return "10";
  if (ipInCidr(ip, FINANCE_CIDR)) return "20";
  if (ipInCidr(ip, "192.168.30.0/24")) return "30";
  if (ipInCidr(ip, FLOOR4_CIDR)) return "40";
  return null;
}

export function seedFwRules(): FwRule[] {
  return [
    {
      id: "FW-CORE",
      action: "allow",
      src: "0.0.0.0/0",
      dst: CORE_CIDR,
      proto: "any",
      comment: "Core services — DNS / intranet / files",
      sticky: true,
    },
  ];
}

export function ruleMatches(rule: FwRule, src: string, dst: string): boolean {
  return ipInCidr(src, rule.src) && ipInCidr(dst, rule.dst);
}

export function firewallAllows(src: string, dst: string, state: GameState): boolean {
  const rules = state.world.fwRules ?? seedFwRules();
  for (const rule of rules) {
    if (rule.action === "deny" && ruleMatches(rule, src, dst)) return false;
  }
  for (const rule of rules) {
    if (rule.action === "allow" && ruleMatches(rule, src, dst)) return true;
  }
  if (ipInCidr(dst, CORE_CIDR)) return true;
  const a = userVlan(src);
  const b = userVlan(dst);
  if (b && a !== b) return false;
  return true;
}

export function vlanForIp(ip: string): number | null {
  return userVlan(ip) ? Number(userVlan(ip)) : null;
}

export function seedSwitchPorts(): SwitchPort[] {
  return [
    { id: "Gi0/8", vlan: 10, hostId: "WS-001", state: "up" },
    { id: "Gi0/12", vlan: 20, hostId: "PC-MARIE", state: "up" },
    { id: "Gi0/14", vlan: 40, hostId: "PC-NOUR", state: "up" },
    { id: "Gi0/16", vlan: 30, hostId: "PC-PAUL", state: "up" },
    { id: "Gi0/20", vlan: 10, hostId: "AP-01", state: "up" },
    { id: "Gi0/22", vlan: 10, hostId: "PC-WIN", state: "up" },
    { id: "Gi0/24", vlan: 10, hostId: "PRN-01", state: "up" },
  ];
}

export const WIFI_CORP_SSID = "HORIZON-CORP";
export const WIFI_GUEST_SSID = "HORIZON-GUEST";

export function isWindowsOs(os: string): boolean {
  return /windows/i.test(os);
}

export function isApOs(os: string): boolean {
  return /unifi|ubiquiti/i.test(os);
}

export function primaryIface(host: HostRuntime): { name: string; iface: IfaceRuntime } | null {
  const skipWifi = host.wifiClient && !host.wifiClient.connected;
  const order = ["Ethernet", "eth0", "Wi-Fi", "wlan0"];
  for (const name of order) {
    if (skipWifi && (name === "Wi-Fi" || name === "wlan0")) continue;
    const iface = host.ifaces[name];
    if (iface && iface.state === "up" && iface.ip) return { name, iface };
  }
  for (const [name, iface] of Object.entries(host.ifaces)) {
    if (skipWifi && (name === "Wi-Fi" || name === "wlan0")) continue;
    if (iface.state === "up" && iface.ip) return { name, iface };
  }
  const first = Object.entries(host.ifaces)[0];
  return first ? { name: first[0], iface: first[1] } : null;
}

export function findApBySsid(state: GameState, ssid: string): HostRuntime | undefined {
  return Object.values(state.world.hosts).find(
    (h) => h.wifiAp?.enabled && h.wifiAp.ssid.toLowerCase() === ssid.toLowerCase()
  );
}

export function wifiLeaseForVlan(vlan: number): {
  ip: string;
  cidr: number;
  gw: string;
  dns: string;
} {
  if (vlan === 30) {
    return { ip: "192.168.30.51", cidr: 24, gw: "192.168.30.1", dns: "1.1.1.1" };
  }
  return { ip: "192.168.10.61", cidr: 24, gw: "192.168.10.1", dns: "10.0.0.10" };
}

export function associateWifi(client: HostRuntime, ap: HostRuntime): boolean {
  if (!ap.wifiAp?.enabled) {
    if (client.wifiClient) client.wifiClient.connected = false;
    const wifi = client.ifaces["Wi-Fi"];
    if (wifi) {
      wifi.state = "down";
      delete wifi.ip;
      delete wifi.gw;
    }
    return false;
  }
  const lease = wifiLeaseForVlan(ap.wifiAp.vlan);
  client.wifiClient = { ssid: ap.wifiAp.ssid, connected: true };
  client.ifaces["Wi-Fi"] = {
    state: "up",
    dhcp: true,
    ip: lease.ip,
    cidr: lease.cidr,
    gw: lease.gw,
  };
  client.dns = [lease.dns];
  client.logs.push(
    `Sep 12 wlan: associated ${ap.wifiAp.ssid} vlan ${ap.wifiAp.vlan} dhcp ${lease.ip}`
  );
  return true;
}

function l2PortFor(host: HostRuntime, state: GameState): SwitchPort | undefined {
  const ports = state.world.switchPorts;
  if (!ports?.length) return undefined;
  if (host.wifiClient?.connected && host.wifiClient.ssid) {
    const ap = findApBySsid(state, host.wifiClient.ssid);
    if (ap) {
      const apPort = ports.find((p) => p.hostId === ap.id);
      if (apPort) return apPort;
    }
  }
  return ports.find((p) => p.hostId === host.id);
}

export function l2Allowed(host: HostRuntime, targetIp: string, state: GameState): boolean {
  if (!state.world.enforceAccessVlan) return true;
  const ports = state.world.switchPorts;
  if (!ports?.length) return true;
  const srcPort = l2PortFor(host, state);
  if (!srcPort) return true;
  if (srcPort.state !== "up") return false;
  const need = vlanForIp(targetIp);
  if (need === null) return true;
  let destHostId: string | undefined;
  for (const [id, h] of Object.entries(state.world.hosts)) {
    for (const i of Object.values(h.ifaces)) {
      if (i.ip === targetIp) destHostId = id;
    }
  }
  if (destHostId === "RTR-HQ" || destHostId === "SW-01") {
    return srcPort.vlan === need;
  }
  const destHost = destHostId ? state.world.hosts[destHostId] : undefined;
  const dstPort = destHost ? l2PortFor(destHost, state) : undefined;
  if (dstPort) return dstPort.state === "up" && srcPort.vlan === dstPort.vlan;
  return srcPort.vlan === need;
}

export function formatSwitchPorts(ports: SwitchPort[]): string[] {
  const lines = [
    "Port      VLAN  Status  Host",
    "--------------------------------",
  ];
  for (const p of ports) {
    lines.push(
      `${p.id.padEnd(9)} ${String(p.vlan).padEnd(5)} ${p.state.padEnd(7)} ${p.hostId ?? "-"}`
    );
  }
  return lines;
}

export function formatVlanTable(ports: SwitchPort[]): string[] {
  const names: Record<number, string> = {
    10: "OFFICE",
    20: "FINANCE",
    30: "LOGISTICS",
    40: "FLOOR4",
  };
  const lines = ["VLAN  Name", "----------------"];
  for (const vlan of [10, 20, 30, 40]) {
    const members = ports.filter((p) => p.vlan === vlan).map((p) => p.id).join(", ");
    lines.push(`${String(vlan).padEnd(5)} ${names[vlan]}${members ? `  (${members})` : ""}`);
  }
  return lines;
}

export function formatFwList(rules: FwRule[]): string[] {
  const lines = [
    "Chain FORWARD (policy INTER-VLAN DROP, core ALLOW)",
  ];
  if (!rules.length) {
    lines.push("(no extra rules)");
    return lines;
  }
  lines.push("ID        ACTION  SOURCE              DESTINATION         COMMENT");
  for (const rule of rules) {
    const sticky = rule.sticky ? " [policy]" : "";
    lines.push(
      `${rule.id.padEnd(9)} ${rule.action.padEnd(7)} ${rule.src.padEnd(19)} ${rule.dst.padEnd(19)} ${rule.comment}${sticky}`
    );
  }
  return lines;
}

// ---------------- Hosts (runtime seed) ----------------

export function seedHosts(): Record<string, HostRuntime> {
  const hosts: Record<string, HostRuntime> = {};
  const add = (h: HostRuntime) => {
    hosts[h.id] = h;
  };

  add({
    id: "WS-001",
    label: "WS-001 — Votre poste",
    os: "Ubuntu 22.04 LTS",
    room: "Bureau 3B",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "192.168.10.24", cidr: 24, gw: "192.168.10.1" },
    },
    dns: ["192.168.1.53"], // FAULT: dead DNS server (lab scenario)
    services: { "systemd-networkd": "active", "systemd-resolved": "active" },
    netplanPath: "/etc/netplan/01-netcfg.yaml",
    logs: [],
  });

  add({
    id: "PC-MARIE",
    label: "PC-MARIE — Poste de Marie (Finance)",
    os: "Ubuntu 22.04 LTS",
    room: "Comptabilité",
    ifaces: {
      eth0: { state: "up", dhcp: true }, // no IP: DHCP failed
    },
    dns: ["10.0.0.10"],
    services: { "systemd-networkd": "failed", "systemd-resolved": "active" },
    netplanPath: "/etc/netplan/01-netcfg.yaml",
    logs: [
      "Sep 12 09:02:11 pc-marie systemd[1]: Starting Network Service...",
      "Sep 12 09:02:12 pc-marie dhclient[412]: DHCPDISCOVER on eth0 to 255.255.255.255 port 67 interval 4",
      "Sep 12 09:02:16 pc-marie dhclient[412]: DHCPDISCOVER on eth0 to 255.255.255.255 port 67 interval 8",
      "Sep 12 09:02:24 pc-marie dhclient[412]: DHCPDISCOVER on eth0 to 255.255.255.255 port 67 interval 16",
      "Sep 12 09:02:40 pc-marie dhclient[412]: No DHCPOFFERS received.",
      "Sep 12 09:02:40 pc-marie dhclient[412]: No working leases in persistent database - sleeping.",
      "Sep 12 09:02:41 pc-marie avahi-autoipd[512]: Successfully claimed IP address 169.254.8.41",
      "Sep 12 09:03:02 pc-marie systemd[1]: systemd-networkd.service: Main process exited, code=exited, status=1/FAILURE",
      "Sep 12 09:03:02 pc-marie systemd[1]: systemd-networkd.service: Failed with result 'exit-code'.",
    ],
  });

  add({
    id: "PC-PAUL",
    label: "PC-PAUL — Poste de Paul (Logistique)",
    os: "Ubuntu 22.04 LTS",
    room: "Quai logistique",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "192.168.30.12", cidr: 24, gw: "192.168.30.1" },
    },
    dns: ["10.0.0.10"], // overwritten by sim variant
    services: { "systemd-networkd": "active", "systemd-resolved": "active" },
    netplanPath: "/etc/netplan/01-netcfg.yaml",
    logs: [
      "Sep 12 10:14:02 pc-paul systemd[1]: Starting Network Service...",
      "Sep 12 10:14:03 pc-paul systemd-networkd[301]: eth0: Link UP",
      "Sep 12 10:14:03 pc-paul systemd-networkd[301]: eth0: Gained carrier",
    ],
  });

  add({
    id: "RTR-HQ",
    label: "RTR-HQ — Routeur du siège",
    os: "Debian 12 (routeur)",
    room: "Baie 1",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "192.168.10.1", cidr: 24 },
      eth1: { state: "up", dhcp: false, ip: "192.168.20.1", cidr: 24 },
      eth2: { state: "up", dhcp: false, ip: "192.168.30.1", cidr: 24 },
      eth3: { state: "up", dhcp: false, ip: "10.0.0.1", cidr: 24 },
      eth4: { state: "up", dhcp: false, ip: "192.168.40.1", cidr: 26 },
    },
    dns: ["10.0.0.10"],
    services: { "isc-dhcp-server": "active", "named": "active", "frr": "active" },
    logs: [
      "Sep 12 08:00:01 rtr-hq dhcpd: DHCPDISCOVER from 00:1a:2b:3c:4d:5e via 192.168.20.1",
      "Sep 12 08:00:02 rtr-hq dhcpd: DHCPOFFER on 192.168.20.45 to 00:1a:2b:3c:4d:5e",
      "Sep 12 08:00:02 rtr-hq dhcpd: DHCPACK on 192.168.20.45 to 00:1a:2b:3c:4d:5e",
    ],
  });

  add({
    id: "DNS-01",
    label: "DNS-01 — Serveur DNS",
    os: "Debian 12",
    room: "Baie 2",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "10.0.0.10", cidr: 24, gw: "10.0.0.1" },
    },
    dns: ["10.0.0.10"],
    services: { "named": "active", "systemd-resolved": "active" },
    logs: [
      "Sep 12 08:45:10 dns-01 named[901]: zone horizon.local/IN: loaded serial 2024091201",
      "Sep 12 08:45:11 dns-01 named[901]: running",
    ],
  });

  add({
    id: "COMP-01",
    label: "COMP-01 — Serveur de fichiers",
    os: "Ubuntu 22.04 LTS",
    room: "Baie 2",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "10.0.0.30", cidr: 24, gw: "10.0.0.1" },
    },
    dns: ["10.0.0.10"],
    services: { "smbd": "active", "backup-agent": "active" },
    logs: [
      "Sep 12 02:00:00 comp-01 backup-agent: nightly backup started",
      "Sep 12 02:04:11 comp-01 backup-agent: WARNING: 2 locked files skipped",
      "Sep 12 02:04:12 comp-01 backup-agent: backup completed with warnings",
    ],
  });

  add({
    id: "SRV-WEB",
    label: "SRV-WEB — Serveur intranet",
    os: "Debian 12 (nginx)",
    room: "Baie 2",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "10.0.0.20", cidr: 24, gw: "10.0.0.1" },
    },
    dns: ["10.0.0.10"],
    services: { "nginx": "active", "php-fpm": "active" },
    logs: [
      "Sep 12 08:30:00 srv-web nginx: 192.168.10.5 - GET / 200",
      "Sep 12 08:31:14 srv-web nginx: 192.168.10.5 - GET /portal 200",
    ],
  });

  add({
    id: "SW-01",
    label: "SW-01 — Commutateur d'étage",
    os: "HP ProCurve (L2)",
    room: "Baie 1",
    ifaces: {
      vlan10: { state: "up", dhcp: false, ip: "192.168.10.2", cidr: 24 },
      vlan20: { state: "up", dhcp: false, ip: "192.168.20.2", cidr: 24 },
      vlan30: { state: "up", dhcp: false, ip: "192.168.30.2", cidr: 24 },
      vlan40: { state: "up", dhcp: false, ip: "192.168.40.2", cidr: 26 },
    },
    dns: ["10.0.0.10"],
    services: {},
    logs: [
      "Sep 12 08:00:00 sw-01: ports 1-24 active",
      "Sep 12 08:00:00 sw-01: VLAN 10,20,30,40 trunk up",
    ],
  });

  add({
    id: "AP-01",
    label: "AP-01 — Point d'accès Wi-Fi",
    os: "UniFi AP",
    room: "Couloir 3",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "192.168.10.5", cidr: 24, gw: "192.168.10.1" },
    },
    dns: ["10.0.0.10"],
    services: { "hostapd": "active" },
    wifiAp: { ssid: WIFI_CORP_SSID, vlan: 10, enabled: true },
    logs: [
      "Sep 12 08:12:00 ap-01 hostapd: 14 stations associated",
    ],
  });

  add({
    id: "PC-WIN",
    label: "PC-WIN — Banc helpdesk Windows",
    os: "Windows 11 Pro",
    room: "Helpdesk — banc 1",
    ifaces: {
      Ethernet: { state: "up", dhcp: false, ip: "192.168.10.55", cidr: 24, gw: "192.168.10.1" },
      "Wi-Fi": { state: "down", dhcp: true },
    },
    dns: ["10.0.0.10"],
    services: { spooler: "active" },
    wifiClient: { ssid: null, connected: false },
    accounts: { student: { name: "student", locked: false, active: true } },
    logs: [
      "Sep 12 08:00:00 pc-win: Windows 11 Pro started",
    ],
  });

  add({
    id: "PC-AMINA",
    label: "PC-AMINA — Portable d'Amina (Accueil)",
    os: "Windows 11 Pro",
    room: "Accueil",
    ifaces: {
      "Wi-Fi": {
        state: "up",
        dhcp: true,
        ip: "192.168.10.61",
        cidr: 24,
        gw: "192.168.10.1",
      },
    },
    dns: ["10.0.0.10"],
    services: { spooler: "active" },
    wifiClient: { ssid: WIFI_CORP_SSID, connected: true },
    accounts: { amina: { name: "amina", locked: false, active: true } },
    logs: [
      "Sep 12 08:20:00 pc-amina: associated HORIZON-CORP",
    ],
  });

  add({
    id: "PRN-01",
    label: "PRN-01 — Imprimante accueil",
    os: "HP LaserJet (JetDirect)",
    room: "Accueil",
    ifaces: {
      eth0: { state: "up", dhcp: false, ip: "192.168.10.88", cidr: 24, gw: "192.168.10.1" },
    },
    dns: ["10.0.0.10"],
    services: {},
    logs: ["Sep 12 08:00:00 prn-01: JetDirect ready"],
  });

  add({
    id: "PC-NOUR",
    label: "PC-NOUR — Poste de Nour (4e étage)",
    os: "Ubuntu 22.04 LTS",
    room: "Étage 4 — Bureau 4C",
    ifaces: {
      eth0: {
        state: "up",
        dhcp: false,
        ip: "192.168.40.24",
        cidr: 26,
        gw: "192.168.40.1",
      },
    },
    dns: ["10.0.0.10"],
    services: { "systemd-networkd": "active", "systemd-resolved": "active" },
    netplanPath: "/etc/netplan/01-netcfg.yaml",
    logs: [
      "Sep 12 11:02:01 pc-nour systemd-networkd[301]: eth0: Link UP",
      "Sep 12 11:02:02 pc-nour systemd-networkd[301]: eth0: Gained carrier",
    ],
  });

  return hosts;
}

// ---------------- DNS zone (authoritative on DNS-01) ----------------
export const DNS_ZONE: Record<string, string> = {
  "intranet.horizon": "10.0.0.20",
  "www.horizon": "10.0.0.20",
  "portal.horizon": "10.0.0.21",
  "mail.horizon": "10.0.0.22",
  "soc.horizon": "10.0.0.23",
  "training.horizon": "10.0.0.24",
  "dns-01.horizon.local": "10.0.0.10",
  "srv-web.horizon.local": "10.0.0.20",
  "comp-01.horizon.local": "10.0.0.30",
};

export const INTERNAL_SITES: Record<string, { title: string; body: string }> = {
  "intranet.horizon": {
    title: "HORIZON Intranet",
    body: "Bienvenue sur l'intranet HORIZON. Actualités, annuaire, procédures IT.",
  },
  "www.horizon": {
    title: "HORIZON Corp",
    body: "Site institutionnel HORIZON CORPORATION.",
  },
  "portal.horizon": {
    title: "Portail RH",
    body: "Connexion au portail RH (simulation).",
  },
  "mail.horizon": {
    title: "Webmail HORIZON",
    body: "Utilisez l'application Mail du poste.",
  },
  "soc.horizon": {
    title: "SOC Portal",
    body: "Accès réservé à l'équipe sécurité.",
  },
  "training.horizon": {
    title: "Académie HORIZON",
    body: "Plateforme de formation interne.",
  },
};

// ---------------- NPCs ----------------
export interface NpcDef {
  id: string;
  nameKey: string;
  roleKey: string;
  dept: string;
}

export const NPCS: NpcDef[] = [
  { id: "lena", nameKey: "npc.lena", roleKey: "npc.lenaRole", dept: "IT" },
  { id: "marie", nameKey: "npc.marie", roleKey: "npc.marieRole", dept: "Finance" },
  { id: "marc", nameKey: "npc.marc", roleKey: "npc.marcRole", dept: "Finance" },
  { id: "paul", nameKey: "npc.paul", roleKey: "npc.paulRole", dept: "Logistique" },
  { id: "soriya", nameKey: "npc.soriya", roleKey: "npc.soriyaRole", dept: "SOC" },
  { id: "nour", nameKey: "npc.nour", roleKey: "npc.nourRole", dept: "Produit" },
  { id: "amina", nameKey: "npc.amina", roleKey: "npc.aminaRole", dept: "Accueil" },
];

// ---------------- Topology (for the Network app) ----------------
export interface TopoNode {
  id: string;
  label: string;
  kind: "router" | "switch" | "pc" | "server" | "ap" | "cloud";
  x: number;
  y: number;
}

export const TOPO_NODES: TopoNode[] = [
  { id: "RTR-HQ", label: "RTR-HQ", kind: "router", x: 400, y: 80 },
  { id: "SW-01", label: "SW-01", kind: "switch", x: 400, y: 200 },
  { id: "DNS-01", label: "DNS-01", kind: "server", x: 180, y: 200 },
  { id: "COMP-01", label: "COMP-01", kind: "server", x: 620, y: 200 },
  { id: "SRV-WEB", label: "SRV-WEB", kind: "server", x: 180, y: 310 },
  { id: "WS-001", label: "WS-001", kind: "pc", x: 290, y: 310 },
  { id: "PC-MARIE", label: "PC-MARIE", kind: "pc", x: 400, y: 310 },
  { id: "PC-PAUL", label: "PC-PAUL", kind: "pc", x: 510, y: 310 },
  { id: "AP-01", label: "AP-01", kind: "ap", x: 620, y: 310 },
  { id: "PC-NOUR", label: "PC-NOUR", kind: "pc", x: 700, y: 200 },
  { id: "PC-WIN", label: "PC-WIN", kind: "pc", x: 290, y: 400 },
  { id: "PC-AMINA", label: "PC-AMINA", kind: "pc", x: 510, y: 400 },
  { id: "PRN-01", label: "PRN-01", kind: "pc", x: 620, y: 400 },
];

export const TOPO_LINKS: [string, string][] = [
  ["RTR-HQ", "SW-01"],
  ["RTR-HQ", "DNS-01"],
  ["RTR-HQ", "COMP-01"],
  ["SW-01", "SRV-WEB"],
  ["SW-01", "WS-001"],
  ["SW-01", "PC-MARIE"],
  ["SW-01", "PC-PAUL"],
  ["SW-01", "AP-01"],
  ["SW-01", "PC-NOUR"],
  ["SW-01", "PC-WIN"],
  ["AP-01", "PC-AMINA"],
  ["SW-01", "PRN-01"],
];

// ---------------- Initial content ----------------
export const CHANNELS = [
  { id: "itsupport", nameKey: "chat.itSupport", topic: "Support IT interne" },
  { id: "soc", nameKey: "chat.soc", topic: "Alertes de sécurité" },
  { id: "general", nameKey: "chat.general", topic: "Vie de l'entreprise" },
];

export function initialMails(): { id: string; from: string; to: string; subjectKey: string; bodyKey: string; phish?: boolean; at: number; attachments?: { name: string; kind: "log" | "doc" | "screenshot" }[] }[] {
  return [
    {
      id: "mail-welcome",
      from: "itsd",
      to: "player",
      subjectKey: "mailContent.welcomeSubject",
      bodyKey: "mailContent.welcomeBody",
      at: 8 * 60 + 30,
    },
    {
      id: "mail-phish",
      from: "noreply@horizon-secure.io",
      to: "player",
      subjectKey: "mailContent.phishSubject",
      bodyKey: "mailContent.phishBody",
      phish: true,
      at: 8 * 60 + 35,
    },
    {
      id: "mail-cert",
      from: "soriya",
      to: "player",
      subjectKey: "mailContent.certExpirySubject",
      bodyKey: "mailContent.certExpiryBody",
      at: 8 * 60 + 40,
    },
    {
      id: "mail-backup",
      from: "itsd",
      to: "player",
      subjectKey: "mailContent.backupFailSubject",
      bodyKey: "mailContent.backupFailBody",
      at: 8 * 60 + 45,
      attachments: [{ name: "backup-report.log", kind: "log" }],
    },
    {
      id: "mail-soc-week",
      from: "soriya",
      to: "player",
      subjectKey: "mailContent.reportSubject",
      bodyKey: "mailContent.reportBody",
      at: 8 * 60 + 50,
    },
  ];
}

export function initialChat(): { id: string; channel: string; from: string; textKey: string; at: number; system?: boolean }[] {
  return [
    { id: "c0", channel: "itsupport", from: "lena", textKey: "intro.msg1", at: 8 * 60 + 32 },
    { id: "c1", channel: "itsupport", from: "lena", textKey: "intro.msg3", at: 8 * 60 + 33 },
    { id: "c2", channel: "general", from: "system", textKey: "intro.msg2", at: 8 * 60 + 34, system: true },
  ];
}
