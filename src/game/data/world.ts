// ============================================================
// HORIZON CYBER ACADEMY — World data
// Hosts, DNS zone, NPCs, initial mail/chat, topology.
// The world is persistent: missions mutate host runtime state,
// tickets and NPC moods; the engine snapshots it into saves.
// ============================================================

import type { HostRuntime } from "../types";

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
    },
    dns: ["10.0.0.10"],
    services: {},
    logs: [
      "Sep 12 08:00:00 sw-01: ports 1-24 active",
      "Sep 12 08:00:00 sw-01: VLAN 10,20,30 trunk up",
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
    logs: [
      "Sep 12 08:12:00 ap-01 hostapd: 14 stations associated",
    ],
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
    body: "Accès réservé à l'équipe sécurité (chapitre 4).",
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
