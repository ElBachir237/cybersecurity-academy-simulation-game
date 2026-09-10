// ============================================================
// HORIZON CYBER ACADEMY — Terminal simulator
// A coherent shell: every output reflects the live world state
// (interfaces, routes, DNS, services, logs). All network faults
// are reproducible and verifiable through real diagnostic reflexes.
// ============================================================

import type { GameState, HostRuntime } from "./types";
import type { TFn } from "./i18n";
import {
  DNS_ZONE,
  INTERNAL_SITES,
  WIFI_CORP_SSID,
  WIFI_GUEST_SSID,
  associateWifi,
  findApBySsid,
  firewallAllows,
  formatFwList,
  formatSwitchPorts,
  formatVlanTable,
  ipInCidr,
  isApOs,
  isWindowsOs,
  l2Allowed,
  primaryIface,
  seedFwRules,
  seedSwitchPorts,
} from "./data/world";
import type { FwRule, SwitchPort } from "./types";

export interface TermSignals {
  cmd: string;
  argv: string[];
  serviceRestart?: { service: string };
  serviceStop?: { service: string };
  dhcpRequested?: boolean;
  netplanApplied?: boolean;
  linkSet?: { iface: string; state: "up" | "down" };
  clear?: boolean;
}

export interface TermResult {
  output: string[];
  openEditor?: { path: string; content: string };
  signals: TermSignals;
}

// ---------------- IP helpers ----------------
function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0) >>> 0;
}

function sameSubnet(a: string, b: string, cidr: number): boolean {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return (ipToInt(a) & mask) === (ipToInt(b) & mask);
}

function macFor(hostId: string, iface: string): string {
  let h = 0;
  for (let i = 0; i < hostId.length + iface.length; i++)
    h = (h * 31 + (hostId.charCodeAt(i % hostId.length) + iface.charCodeAt(i % iface.length))) >>> 0;
  const b = [8, 0, 39, (h >> 16) & 255, (h >> 8) & 255, h & 255];
  return b.map((x) => x.toString(16).padStart(2, "0")).join(":");
}

// ---------------- Name resolution ----------------
export function resolveName(
  name: string,
  host: HostRuntime,
  state: GameState
): string | null {
  const zoneName = name.replace(/\.$/, "").toLowerCase();
  if (DNS_ZONE[zoneName]) {
    // Resolution requires a configured DNS server that is a LIVE world host
    // running an active DNS service (named / systemd-resolved) AND is
    // network-reachable. A decommissioned IP fails resolution even when
    // the gateway can route to it.
    const dns = host.dns[0];
    if (!dns) return null;
    const dnsHost = Object.values(state.world.hosts).find((h) =>
      Object.values(h.ifaces).some((i) => i.ip === dns)
    );
    if (!dnsHost) return null;
    const svc = dnsHost.services["named"] ?? dnsHost.services["systemd-resolved"];
    if (svc !== "active") return null;
    if (!ipReachable(dns, host, state)) return null;
    return DNS_ZONE[zoneName];
  }
  return null;
}

type PathResult = "ok" | "no-iface" | "no-route" | "filtered";

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line.trim()))) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]!);
  }
  return tokens;
}

function maskToCidr(mask: string): number | null {
  const parts = mask.split(".").map((o) => Number(o));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  const bits = parts.map((n) => n.toString(2).padStart(8, "0")).join("");
  if (!/^1*0*$/.test(bits)) return null;
  return bits.split("1").length - 1;
}

function cidrToMask(cidr: number): string {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return [24, 16, 8, 0].map((s) => String((mask >>> s) & 255)).join(".");
}

function pathTo(target: string, host: HostRuntime, state: GameState): PathResult {
  if (host.wifiClient && !host.wifiClient.connected && !host.ifaces.Ethernet && !host.ifaces.eth0) {
    const wifi = host.ifaces["Wi-Fi"];
    if (!wifi || wifi.state !== "up" || !wifi.ip) return "no-iface";
  }
  const picked = primaryIface(host);
  const iface = picked?.iface;
  if (!iface || iface.state !== "up" || !iface.ip) return "no-iface";
  if (target === iface.ip) return "ok";
  if (target.startsWith("127.")) return "ok";
  if (iface.cidr && sameSubnet(target, iface.ip, iface.cidr)) {
    return l2Allowed(host, target, state) ? "ok" : "no-route";
  }
  if (!iface.gw || !iface.cidr || !sameSubnet(iface.gw, iface.ip, iface.cidr)) {
    return "no-route";
  }
  if (!l2Allowed(host, iface.gw, state)) return "no-route";
  let gwExists = false;
  for (const h of Object.values(state.world.hosts)) {
    for (const i of Object.values(h.ifaces)) {
      if (i.ip === iface.gw) gwExists = true;
    }
  }
  if (!gwExists) return "no-route";
  if (!firewallAllows(iface.ip, target, state)) return "filtered";
  return "ok";
}

export function ipReachable(
  target: string,
  host: HostRuntime,
  state: GameState
): boolean {
  return pathTo(target, host, state) === "ok";
}

// ---------------- File content generation ----------------
function genResolvConf(host: HostRuntime): string {
  return host.dns.map((d) => `nameserver ${d}`).join("\n") + "\n";
}

function genNetplan(host: HostRuntime): string {
  const lines: string[] = [
    "# /etc/netplan/01-netcfg.yaml — configuration réseau HORIZON",
    "network:",
    "  version: 2",
    "  renderer: networkd",
    "  ethernets:",
  ];
  for (const [name, i] of Object.entries(host.ifaces)) {
    lines.push(`    ${name}:`);
    lines.push(`      dhcp4: ${i.dhcp ? "true" : "false"}`);
    if (!i.dhcp && i.ip && i.cidr) {
      lines.push(`      addresses:`);
      lines.push(`        - ${i.ip}/${i.cidr}`);
      if (i.gw) {
        lines.push(`      routes:`);
        lines.push(`        - to: default`);
        lines.push(`          via: ${i.gw}`);
      }
    }
    if (host.dns.length) {
      lines.push(`      nameservers:`);
      lines.push(`        addresses: [${host.dns.join(", ")}]`);
    }
  }
  return lines.join("\n") + "\n";
}

function genHosts(host: HostRuntime): string {
  return [
    "127.0.0.1 localhost",
    "127.0.1.1 " + host.id.toLowerCase(),
    "::1 ip6-localhost ip6-loopback",
    "",
  ].join("\n");
}

export function readHostFile(path: string, host: HostRuntime, state: GameState): string | null {
  return readFileInternal(path, host, state);
}

function readFileInternal(path: string, host: HostRuntime, state: GameState): string | null {
  const override = state.vfs[host.id]?.[path];
  if (override !== undefined) return override;
  switch (path) {
    case "/etc/hostname":
      return host.id.toLowerCase() + "\n";
    case "/etc/hosts":
      return genHosts(host);
    case "/etc/os-release":
      return 'NAME="Ubuntu"\nVERSION="22.04 LTS (Jammy Jellyfish)"\nID=ubuntu\n';
    case "/etc/resolv.conf":
      return genResolvConf(host);
    case "/etc/netplan/01-netcfg.yaml":
      return genNetplan(host);
    case "/var/log/syslog":
      return host.logs.length ? host.logs.join("\n") + "\n" : "";
    case "/home/student/README.txt":
      return [
        "Bienvenue sur votre poste HORIZON.",
        "",
        "Raccourcis utiles :",
        "  help                liste des commandes",
        "  ip addr             configuration réseau",
        "  ip route            table de routage",
        "  ping <hôte>         tester la connectivité",
        "  cat <fichier>       afficher un fichier",
        "  sudo systemctl ...  gérer les services",
        "",
      ].join("\n");
    case "/home/student/notes.txt":
      return [
        "Notes personnelles — jour 1",
        "- Contacter Lena Kovac (IT) pour la présentation.",
        "- Le serveur DNS du siège est 10.0.0.10 (DNS-01).",
        "- Le routeur du siège est RTR-HQ (192.168.10.1 / 192.168.20.1 / 192.168.30.1).",
        "- Ne jamais redémarrer un serveur sans preuve.",
        "",
      ].join("\n");
    default:
      return null;
  }
}

function isSudo(line: string): boolean {
  return line.trim().startsWith("sudo ");
}

function stripSudo(argv: string[]): string[] {
  return argv[0] === "sudo" ? argv.slice(1) : argv;
}

// ---------------- Command: ping ----------------
function cmdPing(argv: string[], host: HostRuntime, state: GameState, t: TFn): string[] {
  const target = argv.find((a) => !a.startsWith("-"));
  if (!target) return isWindowsOs(host.os) ? ["Usage: ping [-n count] destination"] : ["ping: usage: ping [-c count] destination"];
  const isName = /[a-zA-Z]/.test(target);
  let ip = target;
  if (isName) {
    const resolved = resolveName(target, host, state);
    if (!resolved) {
      return isWindowsOs(host.os)
        ? [`Ping request could not find host ${target}. Please check the name and try again.`]
        : [`ping: ${target}: ${t("terminal.pingDnsFail", { host: target })}`];
    }
    ip = resolved;
  }
  const path = pathTo(ip, host, state);
  if (isWindowsOs(host.os)) return formatWindowsPing(target, ip, isName, path, host, t);
  const out: string[] = [];
  const label = isName ? `${target} (${ip})` : ip;
  out.push(`PING ${label} 56(84) bytes of data.`);
  if (path === "ok") {
    for (let i = 1; i <= 4; i++) {
      const ms = (0.4 + Math.random() * 2.5).toFixed(2);
      out.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=64 time=${ms} ms`);
    }
    out.push(t("terminal.pingStats", { target }));
    out.push(t("terminal.packets", { sent: 4, recv: 4, loss: 0 }));
  } else {
    const iface = primaryIface(host)?.iface;
    if (path === "no-iface" || !iface || iface.state !== "up" || !iface.ip) {
      out.push("connect: Network is unreachable");
    } else if (path === "filtered") {
      out.push(t("terminal.pingStats", { target }));
      out.push(t("terminal.packets", { sent: 4, recv: 0, loss: 100 }));
    } else {
      for (let i = 1; i <= 2; i++) {
        out.push(`From ${iface.gw ?? iface.ip} icmp_seq=${i} Destination Host Unreachable`);
      }
      out.push(t("terminal.pingStats", { target }));
      out.push(t("terminal.packets", { sent: 4, recv: 0, loss: 100 }));
    }
  }
  return out;
}

function formatWindowsPing(
  target: string,
  ip: string,
  isName: boolean,
  path: PathResult,
  host: HostRuntime,
  t: TFn
): string[] {
  const label = isName ? `${target} [${ip}]` : ip;
  const out = [`Pinging ${label} with 32 bytes of data:`];
  if (path === "ok") {
    for (let i = 0; i < 4; i++) {
      const ms = Math.max(1, Math.round(0.4 + Math.random() * 3));
      out.push(`Reply from ${ip}: bytes=32 time=${ms}ms TTL=128`);
    }
    out.push("");
    out.push(`Ping statistics for ${ip}:`);
    out.push(`    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`);
    out.push(t("terminal.packets", { sent: 4, recv: 4, loss: 0 }));
  } else {
    const iface = primaryIface(host)?.iface;
    if (path === "no-iface" || !iface || iface.state !== "up" || !iface.ip) {
      out.push("General failure.");
    } else if (path === "filtered") {
      for (let i = 0; i < 4; i++) out.push("Request timed out.");
    } else {
      for (let i = 0; i < 4; i++) {
        out.push(`Reply from ${iface.gw ?? iface.ip}: Destination host unreachable.`);
      }
    }
    out.push("");
    out.push(`Ping statistics for ${ip}:`);
    out.push(`    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),`);
    out.push(t("terminal.packets", { sent: 4, recv: 0, loss: 100 }));
  }
  return out;
}

function isCidr(value: string): boolean {
  const [ip, bits] = value.split("/");
  if (!ip || bits === undefined) return false;
  const n = Number(bits);
  if (!Number.isInteger(n) || n < 0 || n > 32) return false;
  return ipInCidr(ip, value);
}

function nextFwId(rules: FwRule[]): string {
  let max = 0;
  for (const rule of rules) {
    const m = /^FW-(\d+)$/.exec(rule.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `FW-${max + 1}`;
}

function cmdIptables(args: string[], state: GameState, sudo: boolean): string[] {
  if (!sudo) return ["iptables: Permission denied"];
  if (!Array.isArray(state.world.fwRules) || state.world.fwRules.length === 0) {
    state.world.fwRules = seedFwRules();
  }
  const rules = state.world.fwRules;
  const op = args[0];
  if (!op || op === "-L" || op === "--list") {
    return formatFwList(rules);
  }
  if (op === "-D") {
    const id = args[1] === "FORWARD" ? args[2] : args[1];
    if (!id) return ["iptables: usage: iptables -D <id>"];
    const idx = rules.findIndex((r) => r.id === id);
    if (idx < 0) return [`iptables: no such rule ${id}`];
    if (rules[idx].sticky) return [`iptables: cannot delete policy rule ${id}`];
    const removed = rules.splice(idx, 1)[0];
    const rtr = state.world.hosts["RTR-HQ"];
    rtr?.logs.push(`Sep 12 fw: rule ${removed.id} deleted (${removed.src} -> ${removed.dst})`);
    return [`iptables: deleted ${removed.id}`];
  }
  if (op === "-A") {
    let i = args[1] === "FORWARD" ? 2 : 1;
    let src = "0.0.0.0/0";
    let dst = "0.0.0.0/0";
    let action: FwRule["action"] = "allow";
    while (i < args.length) {
      if ((args[i] === "-s" || args[i] === "--source") && args[i + 1]) {
        src = args[i + 1];
        i += 2;
        continue;
      }
      if ((args[i] === "-d" || args[i] === "--destination") && args[i + 1]) {
        dst = args[i + 1];
        i += 2;
        continue;
      }
      if ((args[i] === "-j" || args[i] === "--jump") && args[i + 1]) {
        const jump = args[i + 1].toUpperCase();
        action = jump === "DROP" || jump === "REJECT" || jump === "DENY" ? "deny" : "allow";
        i += 2;
        continue;
      }
      i += 1;
    }
    if (!isCidr(src) || !isCidr(dst)) {
      return ["iptables: -s and -d must be CIDR (ex: 192.168.10.0/24)"];
    }
    const id = nextFwId(rules);
    rules.push({
      id,
      action,
      src,
      dst,
      proto: "any",
      comment: "added by operator",
    });
    const rtr = state.world.hosts["RTR-HQ"];
    rtr?.logs.push(`Sep 12 fw: rule ${id} ${action} ${src} -> ${dst}`);
    return [`iptables: appended ${id} ${action} ${src} -> ${dst}`];
  }
  return [
    "iptables: usage: iptables -L | -D <id> | -A FORWARD -s CIDR -d CIDR -j ACCEPT|DROP",
  ];
}

function ensureSwitchPorts(state: GameState): SwitchPort[] {
  if (!Array.isArray(state.world.switchPorts) || state.world.switchPorts.length === 0) {
    state.world.switchPorts = seedSwitchPorts();
  }
  return state.world.switchPorts;
}

function cmdShow(args: string[], host: HostRuntime, state: GameState): string[] {
  if (host.id !== "SW-01") {
    return ["show: disponible sur SW-01 — sélectionnez le commutateur dans le terminal."];
  }
  const ports = ensureSwitchPorts(state);
  const joined = args.join(" ").toLowerCase();
  if (!args.length || joined.startsWith("vlan")) return formatVlanTable(ports);
  if (
    joined.startsWith("int") ||
    joined.includes("status") ||
    joined.startsWith("interfaces") ||
    joined.startsWith("port")
  ) {
    return formatSwitchPorts(ports);
  }
  return ["show: usage: show vlan | show interfaces status"];
}

function cmdSwitchport(args: string[], host: HostRuntime, state: GameState, sudo: boolean): string[] {
  if (host.id !== "SW-01") {
    return ["switchport: disponible sur SW-01 — sélectionnez le commutateur dans le terminal."];
  }
  if (!sudo) return ["switchport: Permission denied"];
  const ports = ensureSwitchPorts(state);
  const portRaw = args[0];
  const vlanIdx = args.findIndex((a) => a.toLowerCase() === "vlan");
  const vlan = Number(vlanIdx >= 0 ? args[vlanIdx + 1] : args[1]);
  if (!portRaw || !Number.isInteger(vlan)) {
    return ["switchport: usage: sudo switchport Gi0/14 vlan 40"];
  }
  if (![10, 20, 30, 40].includes(vlan)) {
    return ["switchport: VLAN must be 10, 20, 30 or 40"];
  }
  const port = ports.find((p) => p.id.toLowerCase() === portRaw.toLowerCase());
  if (!port) return [`switchport: no such port ${portRaw}`];
  port.vlan = vlan;
  host.logs.push(`Sep 12 sw-01: ${port.id} access vlan ${vlan}`);
  return [`${port.id} access VLAN ${vlan}`];
}

// ---------------- Command: ip ----------------
function cmdIp(args: string[], host: HostRuntime): string[] {
  const sub = args[0];
  const out: string[] = [];
  if (sub === "addr" || sub === "a" || sub === undefined) {
    out.push("1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000");
    out.push("    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00");
    out.push("    inet 127.0.0.1/8 scope host lo");
    out.push("       valid_lft forever preferred_lft forever");
    for (const [name, i] of Object.entries(host.ifaces)) {
      const up = i.state === "up";
      out.push(
        `2: ${name}: <BROADCAST,MULTICAST,${up ? "UP" : "DOWN"}> mtu 1500 qdisc fq_codel state ${up ? "UP" : "DOWN"} group default qlen 1000`
      );
      out.push(`    link/ether ${macFor(host.id, name)} brd ff:ff:ff:ff:ff:ff`);
      if (up && i.ip && !i.dhcp) {
        out.push(`    inet ${i.ip}/${i.cidr} brd ${broadcast(i.ip, i.cidr ?? 24)} scope global ${name}`);
        out.push("       valid_lft forever preferred_lft forever");
      } else if (up && i.dhcp && i.ip) {
        out.push(`    inet ${i.ip}/${i.cidr} brd ${broadcast(i.ip, i.cidr ?? 24)} scope global ${name}`);
        out.push(`       valid_lft ${Math.floor(30000 + Math.random() * 40000)}sec preferred_lft ${Math.floor(20000 + Math.random() * 20000)}sec`);
      } else if (up && i.dhcp && !i.ip) {
        out.push("    inet 169.254.8.41/16 scope link eth0:avahi");
        out.push("       valid_lft forever preferred_lft forever");
      }
    }
  } else if (sub === "route" || sub === "r") {
    const iface = primaryIface(host)?.iface;
    const dev = primaryIface(host)?.name ?? Object.keys(host.ifaces)[0];
    if (iface && iface.state === "up" && iface.ip) {
      if (iface.gw) out.push(`default via ${iface.gw} dev ${dev} proto static`);
      out.push(
        `${networkOf(iface.ip, iface.cidr ?? 24)}/${iface.cidr} dev ${dev} proto kernel scope link src ${iface.ip}`
      );
    }
  } else if (sub === "link") {
    for (const [name, i] of Object.entries(host.ifaces)) {
      out.push(
        `2: ${name}: <BROADCAST,MULTICAST,${i.state === "up" ? "UP" : "DOWN"}> state ${i.state === "up" ? "UP" : "DOWN"} mtu 1500`
      );
      out.push(`    link/ether ${macFor(host.id, name)} brd ff:ff:ff:ff:ff:ff`);
    }
  } else if (sub === "neigh") {
    const iface = host.ifaces.eth0 ?? Object.values(host.ifaces)[0];
    if (iface?.gw && iface.state === "up") {
      out.push(`${iface.gw} dev eth0 lladdr ${macFor("RTR-HQ", "eth0")} REACHABLE`);
    }
  } else {
    out.push(`Usage: ip [ addr | route | link | neigh ]`);
  }
  return out;
}

function broadcast(ip: string, cidr: number): string {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  const bcast = (ipToInt(ip) | ~mask) >>> 0;
  return intToIp(bcast);
}

function networkOf(ip: string, cidr: number): string {
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return intToIp((ipToInt(ip) & mask) >>> 0);
}

function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

// ---------------- Command: systemctl ----------------
function cmdSystemctl(args: string[], host: HostRuntime, t: TFn, sudo: boolean): { out: string[]; signals: Partial<TermSignals> } {
  const action = args[0];
  const svc = args[1];
  const signals: Partial<TermSignals> = {};
  if (!action || !svc) return { out: ["systemctl: usage: systemctl [status|restart|stop|start] <service>"], signals };
  if (action === "status") {
    const st = host.services[svc];
    if (!st) return { out: [t("terminal.noService", { svc }), "", "UNIT FILE     STATE", `${svc}.service  not-found`], signals };
    const active = st === "active";
    const out = [
      `● ${svc}.service - ${svc}`,
      `   Loaded: loaded (/lib/systemd/system/${svc}.service; enabled)`,
      `   Active: ${active ? "active (running)" : st === "failed" ? "failed (Result: exit-code)" : "inactive (dead)"} since Mon 08:00:00 UTC; 1h ago`,
      ` Main PID: ${active ? 1024 + Math.floor(Math.random() * 50) : 0} (${svc.split("-")[0]})`,
    ];
    if (st === "failed") {
      out.push("   Status: \"Starting process...\"");
      out.push("");
      out.push("Sep 12 09:03:02 systemd[1]: Failed with result 'exit-code'.");
    }
    if (active) out.push(`   CGroup: /system.slice/${svc}.service`);
    return { out, signals };
  }
  if (!sudo) return { out: [t("terminal.permissionDenied")], signals };
  if (host.services[svc] === undefined) {
    return { out: [t("terminal.noService", { svc })], signals };
  }
  if (action === "restart") {
    signals.serviceRestart = { service: svc };
    return { out: [t("terminal.serviceRestarted", { svc })], signals };
  }
  if (action === "stop") {
    signals.serviceStop = { service: svc };
    return { out: [t("terminal.serviceStatus", { svc, status: "inactive" })], signals };
  }
  if (action === "start") {
    signals.serviceRestart = { service: svc };
    return { out: [t("terminal.serviceStatus", { svc, status: "active" })], signals };
  }
  return { out: ["systemctl: action non supportée"], signals };
}

// ---------------- Command: dig / nslookup / host ----------------
function cmdDns(argv: string[], host: HostRuntime, state: GameState): string[] {
  const name = argv.find((a) => !a.startsWith("-"));
  if (!name) return ["usage: dig <name>"];
  const ip = resolveName(name, host, state);
  const dnsOk = !!host.dns[0] && ipReachable(host.dns[0], host, state);
  if (!dnsOk) return [`;; connection timed out; no servers could be reached`];
  if (!ip) {
    return [
      `; <<>> DiG 9.18 <<>> ${name}`,
      `;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 12345`,
    ];
  }
  return [
    `; <<>> DiG 9.18 <<>> ${name}`,
    `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 12345`,
    `;; flags: qr aa rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1`,
    ``,
    `;; ANSWER SECTION:`,
    `${name}.\t\t3600\tIN\tA\t${ip}`,
  ];
}

// ---------------- Command: curl ----------------
function cmdCurl(argv: string[], host: HostRuntime, state: GameState, t: TFn): string[] {
  const url = argv.find((a) => a.startsWith("http")) ?? argv.find((a) => !a.startsWith("-"));
  if (!url) return ["curl: try 'curl --help'"];
  const hostName = url.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  const ip = resolveName(hostName, host, state);
  if (!ip || !ipReachable(ip, host, state)) {
    return [t("terminal.curlFail", { url })];
  }
  const site = INTERNAL_SITES[hostName];
  if (site) {
    return [
      `HTTP/1.1 200 OK`,
      `Server: nginx/1.24.0 (simulation)`,
      `Content-Type: text/html`,
      ``,
      `<!DOCTYPE html>`,
      `<html><head><title>${site.title}</title></head>`,
      `<body>`,
      `<h1>${site.title}</h1>`,
      `<p>${site.body}</p>`,
      `</body></html>`,
    ];
  }
  return [t("terminal.curlFail", { url })];
}

function ifaceByName(host: HostRuntime, name: string): string | undefined {
  const keys = Object.keys(host.ifaces);
  const exact = keys.find((k) => k.toLowerCase() === name.toLowerCase());
  return exact;
}

function cmdIpconfig(host: HostRuntime, all: boolean): string[] {
  const out = ["", `Windows IP Configuration`, ""];
  if (all) {
    out.push(`   Host Name . . . . . . . . . . . . : ${host.id.toLowerCase()}`);
    out.push(`   Primary Dns Suffix  . . . . . . . : horizon.local`);
    out.push(`   Node Type . . . . . . . . . . . . : Hybrid`);
    out.push("");
  }
  for (const [name, i] of Object.entries(host.ifaces)) {
    const media = name.toLowerCase().includes("wi") ? "Wireless LAN adapter" : "Ethernet adapter";
    out.push(`${media} ${name}:`);
    out.push("");
    if (i.state !== "up") {
      out.push("   Media State . . . . . . . . . . . : Media disconnected");
      out.push("");
      continue;
    }
    out.push(`   Connection-specific DNS Suffix  . : horizon.local`);
    if (all) out.push(`   Physical Address. . . . . . . . . : ${macFor(host.id, name).toUpperCase().replace(/:/g, "-")}`);
    out.push(`   DHCP Enabled. . . . . . . . . . . : ${i.dhcp ? "Yes" : "No"}`);
    if (i.ip) {
      out.push(`   IPv4 Address. . . . . . . . . . . : ${i.ip}`);
      out.push(`   Subnet Mask . . . . . . . . . . . : ${cidrToMask(i.cidr ?? 24)}`);
      if (i.gw) out.push(`   Default Gateway . . . . . . . . . : ${i.gw}`);
      if (all && host.dns[0]) {
        out.push(`   DNS Servers . . . . . . . . . . . : ${host.dns[0]}`);
        for (const extra of host.dns.slice(1)) out.push(`                                       ${extra}`);
      }
    } else {
      out.push("   Autoconfiguration IPv4 Address. . : 169.254.12.40");
      out.push("   Subnet Mask . . . . . . . . . . . : 255.255.0.0");
    }
    out.push("");
  }
  return out;
}

function cmdNetsh(args: string[], host: HostRuntime, state: GameState): string[] {
  const joined = args.map((a) => a.toLowerCase());
  if (args[0] === "wlan") {
    if (args[1] === "show" && (args[2] === "interfaces" || args[2] === "interface")) {
      const wifi = host.ifaces["Wi-Fi"];
      const client = host.wifiClient;
      if (!wifi) return ["There is no wireless interface on this host."];
      return [
        "There is 1 interface on the system: ",
        "",
        "    Name                   : Wi-Fi",
        `    State                  : ${client?.connected && wifi.state === "up" ? "connected" : "disconnected"}`,
        `    SSID                   : ${client?.connected ? client.ssid ?? "" : ""}`,
        `    Radio type             : 802.11ac`,
        `    IPv4 Address           : ${wifi.ip ?? ""}`,
      ];
    }
    if (args[1] === "show" && args[2] === "profiles") {
      return [
        "Profiles on interface Wi-Fi:",
        "",
        `    All User Profile     : ${WIFI_CORP_SSID}`,
        `    All User Profile     : ${WIFI_GUEST_SSID}`,
      ];
    }
    if (args[1] === "connect") {
      let ssid = netshName(args) ?? "";
      if (!ssid) {
        ssid = args.slice(2).find((a) => !/^(name|name=)$/i.test(a)) ?? "";
      }
      ssid = ssid.replace(/^["']|["']$/g, "");
      if (!ssid) return ['Usage: netsh wlan connect name=<SSID>'];
      const ap = findApBySsid(state, ssid);
      if (!ap) {
        return [`The network with SSID "${ssid}" is not available.`];
      }
      if (!host.ifaces["Wi-Fi"]) host.ifaces["Wi-Fi"] = { state: "down", dhcp: true };
      associateWifi(host, ap);
      return [`Connection request was completed successfully.`];
    }
    return ["The following command was not found: " + args.join(" ")];
  }

  if (args[0] === "interface") {
    if (args[1] === "set" && args[2] === "interface") {
      const name = netshName(args) ?? "Ethernet";
      const key = ifaceByName(host, name);
      if (!key || !host.ifaces[key]) return [`The requested operation requires elevation (Run as administrator).`];
      const admin = args.find((a) => a.toLowerCase().startsWith("admin="))?.split("=")[1]
        ?? args[args.findIndex((a) => a.toLowerCase() === "admin") + 1];
      const on = /^(enabled?|on)$/i.test(admin ?? "");
      const off = /^(disabled?|off)$/i.test(admin ?? "");
      if (!on && !off) return ['Usage: netsh interface set interface name="Ethernet" admin=ENABLED'];
      host.ifaces[key].state = on ? "up" : "down";
      host.logs.push(`Sep 12 netsh: ${key} admin=${on ? "ENABLED" : "DISABLED"}`);
      return [`The requested operation completed successfully.`];
    }
    if (args[1] === "ipv4" && args[2] === "show") {
      return cmdIpconfig(host, true);
    }
    if (args[1] === "ipv4" && args[2] === "set" && args[3] === "address") {
      const name = netshName(args) ?? "Ethernet";
      const key = ifaceByName(host, name);
      if (!key || !host.ifaces[key]) return [`An interface with this name is not registered.`];
      const staticIdx = args.findIndex((a) => a.toLowerCase() === "static");
      if (staticIdx < 0) return ['Usage: netsh interface ipv4 set address name="Ethernet" static <ip> <mask> <gw>'];
      const ip = args[staticIdx + 1];
      const mask = args[staticIdx + 2];
      const gw = args[staticIdx + 3];
      const cidr = mask ? maskToCidr(mask) : null;
      if (!ip || !cidr || !gw) return ["The parameter is incorrect."];
      host.ifaces[key] = { state: "up", dhcp: false, ip, cidr, gw };
      host.logs.push(`Sep 12 netsh: ${key} ${ip}/${cidr} gw ${gw}`);
      return ["The requested operation completed successfully."];
    }
    if (args[1] === "ipv4" && args[2] === "set" && (args[3] === "dnsservers" || args[3] === "dns")) {
      const dns = args.find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
      if (!dns) return ['Usage: netsh interface ipv4 set dnsservers name="Ethernet" static 10.0.0.10'];
      host.dns = [dns];
      host.logs.push(`Sep 12 netsh: dns ${dns}`);
      return ["The requested operation completed successfully."];
    }
  }
  void joined;
  return ["The following command was not found: netsh " + args.join(" ")];
}

function netshName(args: string[]): string | undefined {
  const strip = (s: string) => s.replace(/^["']|["']$/g, "");
  const eq = args.find((a) => a.toLowerCase().startsWith("name="));
  if (eq) return strip(eq.slice(eq.indexOf("=") + 1));
  const idx = args.findIndex((a) => a.toLowerCase() === "name");
  if (idx >= 0) return strip(args[idx + 1] ?? "");
  return undefined;
}

function cmdNetUser(args: string[], host: HostRuntime): string[] {
  const accounts = host.accounts ?? {};
  if (!args.length) {
    const names = Object.keys(accounts);
    return ["User accounts for \\\\" + host.id, "", ...names.map((n) => n), "The command completed successfully."];
  }
  const user = args[0].toLowerCase();
  const acc = accounts[user];
  const flag = args.find((a) => a.startsWith("/"));
  if (flag && /^\/active:(yes|no)$/i.test(flag)) {
    if (!acc) return [`The user name could not be found.`];
    const yes = /yes/i.test(flag);
    acc.active = yes;
    if (yes) acc.locked = false;
    host.logs.push(`Sep 12 net: user ${user} active=${yes}`);
    return ["The command completed successfully."];
  }
  if (!acc) return [`The user name could not be found.`];
  return [
    `User name                    ${acc.name}`,
    `Full Name                    ${acc.name}`,
    `Comment                      HORIZON workstation`,
    `Account active               ${acc.active && !acc.locked ? "Yes" : "No"}`,
    `Account expires              Never`,
    `Password last set            9/1/2026 8:00:00 AM`,
    `Lockout                      ${acc.locked ? "Yes" : "No"}`,
    `The command completed successfully.`,
  ];
}

function execWindowsShell(argv: string[], host: HostRuntime, state: GameState, t: TFn): TermResult {
  const cmd = (argv[0] ?? "").toLowerCase();
  const args = argv.slice(1);
  const signals: TermSignals = { cmd: argv[0] ?? "", argv };
  const out: string[] = [];
  switch (cmd) {
    case "help":
      out.push("Commandes Windows (simulées, syntaxe réelle) :");
      out.push("  ipconfig              configuration IPv4");
      out.push("  ipconfig /all         DNS, DHCP, passerelle");
      out.push("  ping <hôte>           tester la connectivité");
      out.push("  nslookup <nom>        résolution DNS");
      out.push("  netsh interface ...   IP, DNS, admin up/down");
      out.push("  netsh wlan show interfaces | connect name=<SSID>");
      out.push("  net user [nom] [/active:yes]");
      out.push("  net start spooler     service d'impression");
      out.push("  hostname  whoami  cls");
      break;
    case "cls":
      signals.clear = true;
      break;
    case "hostname":
      out.push(host.id);
      break;
    case "whoami":
      out.push(`horizon\\${Object.keys(host.accounts ?? { student: 1 })[0] ?? "student"}`);
      break;
    case "ipconfig":
      out.push(...cmdIpconfig(host, args.includes("/all") || args.includes("-all")));
      break;
    case "ping":
      out.push(...cmdPing(args, host, state, t));
      break;
    case "nslookup":
    case "nslookup.exe":
      out.push(...cmdNslookup(args, host, state));
      break;
    case "netsh":
      out.push(...cmdNetsh(args, host, state));
      break;
    case "net":
      if (args[0]?.toLowerCase() === "user") out.push(...cmdNetUser(args.slice(1), host));
      else if (args[0]?.toLowerCase() === "start") {
        const svc = (args[1] ?? "").toLowerCase();
        if (!svc) out.push("The syntax of this command is:");
        else {
          host.services[svc] = "active";
          out.push(`The ${svc} service was started successfully.`);
        }
      } else if (args[0]?.toLowerCase() === "stop") {
        const svc = (args[1] ?? "").toLowerCase();
        host.services[svc] = "inactive";
        out.push(`The ${svc} service was stopped successfully.`);
      } else out.push("The syntax of this command is:");
      break;
    case "sc":
      if (args[0]?.toLowerCase() === "query") {
        const svc = (args[1] ?? "spooler").toLowerCase();
        const st = host.services[svc] ?? "inactive";
        out.push(`SERVICE_NAME: ${svc}`, `        STATE              : ${st === "active" ? "4  RUNNING" : "1  STOPPED"}`);
      } else out.push("ERROR:  Unrecognized command");
      break;
    case "clear":
      signals.clear = true;
      break;
    default:
      out.push(`'${argv[0]}' is not recognized as an internal or external command,`);
      out.push("operable program or batch file.");
  }
  return { output: out, signals };
}

function cmdNslookup(args: string[], host: HostRuntime, state: GameState): string[] {
  const name = args.find((a) => !a.startsWith("-"));
  if (!name) return ["Default Server:  UnKnown", `Address:  ${host.dns[0] ?? ""}`, ""];
  const ip = resolveName(name, host, state);
  const dnsOk = !!host.dns[0] && ipReachable(host.dns[0], host, state);
  if (!dnsOk) return ["*** UnKnown can't find " + name + ": No response from server"];
  if (!ip) return [`*** UnKnown can't find ${name}: Non-existent domain`];
  return [
    `Server:  dns-01.horizon.local`,
    `Address:  ${host.dns[0]}`,
    "",
    `Name:    ${name}`,
    `Address:  ${ip}`,
  ];
}

function execApShell(argv: string[], host: HostRuntime, state: GameState, t: TFn): TermResult {
  const cmd = (argv[0] ?? "").toLowerCase();
  const args = argv.slice(1);
  const signals: TermSignals = { cmd: argv[0] ?? "", argv };
  const ap = host.wifiAp ?? { ssid: WIFI_CORP_SSID, vlan: 10, enabled: true };
  host.wifiAp = ap;
  const out: string[] = [];
  const applySsid = (ssid: string) => {
    const prev = ap.ssid;
    ap.ssid = ssid;
    host.logs.push(`Sep 12 unifi: ssid ${ssid}`);
    for (const h of Object.values(state.world.hosts)) {
      if (h.wifiClient?.ssid === prev) {
        h.wifiClient.connected = false;
        const wifi = h.ifaces["Wi-Fi"];
        if (wifi) {
          wifi.state = "down";
          delete wifi.ip;
          delete wifi.gw;
        }
      }
    }
  };
  const applyVlan = (vlan: number) => {
    ap.vlan = vlan;
    host.logs.push(`Sep 12 unifi: vlan ${vlan}`);
    reassociateClients(state, host);
  };
  switch (cmd) {
    case "help":
      out.push("UniFi AP CLI (simulé)");
      out.push("  info                 modèle, IP, SSID, VLAN");
      out.push("  show wireless        WLAN / VLAN");
      out.push("  set-ssid <SSID>      SSID diffusé (HORIZON-CORP | HORIZON-GUEST)");
      out.push("  set-vlan <10|30>     VLAN d'accès Wi-Fi");
      out.push("  ping <hôte>");
      break;
    case "info":
      out.push(`Model:       UAP-AC-Pro`);
      out.push(`Version:     6.6.77`);
      out.push(`MAC Address: ${macFor(host.id, "eth0")}`);
      out.push(`IP Address:  ${host.ifaces.eth0?.ip ?? ""}`);
      out.push(`Hostname:    ${host.id}`);
      out.push(`SSID:        ${ap.ssid}`);
      out.push(`VLAN:        ${ap.vlan}`);
      out.push(`Status:      Connected`);
      break;
    case "show":
      if (args[0] === "wireless" || args[0] === "wlan") {
        out.push("SSID            VLAN  Status");
        out.push("--------------------------------");
        out.push(`${ap.ssid.padEnd(16)}${String(ap.vlan).padEnd(6)}${ap.enabled ? "enabled" : "disabled"}`);
      } else out.push("show wireless");
      break;
    case "set-ssid":
    case "setssid": {
      const ssid = args.join(" ");
      if (!ssid) out.push("usage: set-ssid <SSID>");
      else {
        applySsid(ssid);
        out.push(`SSID updated: ${ssid}`);
      }
      break;
    }
    case "set-vlan":
    case "setvlan": {
      const vlan = Number(args[0]);
      if (!Number.isInteger(vlan) || (vlan !== 10 && vlan !== 30 && vlan !== 20 && vlan !== 40)) {
        out.push("usage: set-vlan <10|20|30|40>");
      } else {
        applyVlan(vlan);
        out.push(`WLAN VLAN updated: ${vlan}`);
      }
      break;
    }
    case "set":
      if (args[0] === "ssid" && args[1]) {
        applySsid(args.slice(1).join(" "));
        out.push(`SSID updated: ${ap.ssid}`);
      } else if (args[0] === "vlan" && args[1]) {
        const vlan = Number(args[1]);
        if (!Number.isInteger(vlan)) out.push("usage: set vlan <n>");
        else {
          applyVlan(vlan);
          out.push(`WLAN VLAN updated: ${vlan}`);
        }
      } else out.push("set ssid <SSID> | set vlan <n>");
      break;
    case "ping":
      out.push(...cmdPing(args, host, state, t));
      break;
    case "clear":
      signals.clear = true;
      break;
    default:
      out.push(`Unknown command: ${argv[0]}  (try 'help')`);
  }
  return { output: out, signals };
}

function reassociateClients(state: GameState, ap: HostRuntime): void {
  if (!ap.wifiAp) return;
  for (const h of Object.values(state.world.hosts)) {
    if (!h.wifiClient?.connected) continue;
    if (h.wifiClient.ssid && h.wifiClient.ssid.toLowerCase() === ap.wifiAp.ssid.toLowerCase()) {
      associateWifi(h, ap);
    }
  }
}

function execPrinterShell(argv: string[], host: HostRuntime): TermResult {
  const cmd = (argv[0] ?? "").toLowerCase();
  const signals: TermSignals = { cmd: argv[0] ?? "", argv };
  if (cmd === "help" || cmd === "info" || cmd === "?") {
    return {
      output: [
        "HP JetDirect",
        `Hostname: ${host.id}`,
        `IP: ${host.ifaces.eth0?.ip ?? ""}`,
        "Ready.",
      ],
      signals,
    };
  }
  return { output: [`${argv[0]}: not available on this device`], signals };
}

// ---------------- Main executor ----------------
export function execTerminal(
  line: string,
  hostId: string,
  state: GameState,
  t: TFn
): TermResult {
  const host = state.world.hosts[hostId];
  if (!host) {
    return { output: [`unknown host: ${hostId}`], signals: { cmd: "", argv: [] } };
  }
  const trimmed = line.trim();
  const sudo = isSudo(trimmed);
  const rawArgv = tokenize(trimmed);
  const argv = stripSudo(rawArgv);
  const cmd = argv[0];
  const args = argv.slice(1);
  const signals: TermSignals = { cmd, argv };

  if (!trimmed) return { output: [], signals };

  if (isWindowsOs(host.os)) return execWindowsShell(argv, host, state, t);
  if (isApOs(host.os)) return execApShell(argv, host, state, t);
  if (/jetdirect|laserjet|printer/i.test(host.os)) return execPrinterShell(argv, host);

  const out: string[] = [];

  // `ip link set <iface> up|down` handled here (needs sudo + signals)
  if (cmd === "ip" && args[0] === "link" && args[1] === "set") {
    if (!sudo) return { output: [t("terminal.permissionDenied")], signals };
    const name = args[2];
    const st = args[3] as "up" | "down" | undefined;
    if (!host.ifaces[name ?? ""]) {
      return { output: [`ip: interface introuvable : ${name}`], signals };
    }
    if (st !== "up" && st !== "down") {
      return { output: ["link: usage: ip link set <iface> up|down"], signals };
    }
    signals.linkSet = { iface: name!, state: st };
    out.push(`Interface ${name} → ${st.toUpperCase()}`);
    return { output: out, signals };
  }

  switch (cmd) {
    case "help": {
      out.push(t("terminal.helpTitle"));
      out.push("  whoami hostname date uptime uname   — informations système");
      out.push("  ip addr | ip route | ip link        — configuration réseau");
      out.push("  ping <hôte>                          — tester la connectivité");
      out.push("  dig | nslookup | host <nom>          — résolution DNS");
      out.push("  curl <url>                           — requête HTTP interne");
      out.push("  cat | ls | tail | grep <fichier>     — fichiers & journaux");
      out.push("  sudo nano <fichier>                  — éditer une configuration");
      out.push("  sudo systemctl <status|restart> <svc>— services");
      out.push("  sudo netplan apply                   — appliquer la config réseau");
      out.push("  sudo dhclient <iface>                — demander un bail DHCP");
      out.push("  sudo ip link set <iface> up|down     — activer une interface");
      out.push("  sudo iptables -L | -D <id> | -A ...  — politique FORWARD (simulée)");
      out.push("  show vlan | show interfaces status   — ports du commutateur (SW-01)");
      out.push("  sudo switchport Gi0/14 vlan 40       — VLAN d'accès (SW-01)");
      out.push("  clear | history                      — écran / historique");
      return { output: out, signals };
    }
    case "whoami":
      out.push(sudo ? "root" : "student");
      break;
    case "hostname":
      out.push(host.id.toLowerCase());
      break;
    case "date":
      out.push(new Date().toString());
      break;
    case "uptime":
      out.push(` 09:${String(Math.floor(Math.random() * 50) + 5).padStart(2, "0")}:00 up 2:14,  2 users,  load average: 0.08, 0.03, 0.01`);
      break;
    case "uname":
      out.push(
        args.includes("-a")
          ? `Linux ${host.id.toLowerCase()} 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux`
          : "Linux"
      );
      break;
    case "df":
      out.push("Filesystem      Size  Used Avail Use% Mounted on", "/dev/sda1        40G  8.2G   30G  22% /");
      break;
    case "free":
      out.push("               total        used        free      shared  buff/cache   available", "Mem:         8028160     1843200     4829184      131072     1355776     5847040");
      break;
    case "echo":
      out.push(args.join(" "));
      break;
    case "ping":
      out.push(...cmdPing(args, host, state, t));
      break;
    case "ip":
      out.push(...cmdIp(args, host));
      break;
    case "dig":
    case "nslookup":
    case "host":
      out.push(...cmdDns(args, host, state));
      break;
    case "curl":
    case "wget":
      out.push(...cmdCurl(args, host, state, t));
      break;
    case "cat": {
      const path = args[args.length - 1];
      const content = readFileInternal(path, host, state);
      if (content === null) {
        out.push(`cat: ${t("terminal.noSuchFile", { path })}`);
      } else {
        out.push(...content.split("\n").slice(0, -1));
      }
      break;
    }
    case "tail": {
      let n = 10;
      let path = args[args.length - 1];
      const nIdx = args.indexOf("-n");
      if (nIdx >= 0) {
        n = parseInt(args[nIdx + 1], 10) || 10;
        path = args[args.length - 1];
      }
      const content = readFileInternal(path, host, state);
      if (content === null) out.push(`tail: ${t("terminal.noSuchFile", { path })}`);
      else out.push(...content.split("\n").filter(Boolean).slice(-n));
      break;
    }
    case "ls": {
      const path = args.find((a) => !a.startsWith("-")) ?? ".";
      if (path === "." || path === "/home/student") {
        out.push("README.txt  notes.txt");
      } else if (path === "/etc/netplan") {
        out.push("01-netcfg.yaml");
      } else if (path === "/var/log") {
        out.push("syslog  apt  dpkg.log");
      } else if (path === "/etc") {
        out.push("hostname  hosts  netplan  os-release  resolv.conf");
      } else {
        out.push(`ls: ${t("terminal.noSuchFile", { path })}`);
      }
      break;
    }
    case "grep": {
      // grep pattern [file]
      const pattern = args.find((a) => !a.startsWith("-"));
      const fileIdx = args.findIndex((a) => !a.startsWith("-") && a !== pattern);
      const file = fileIdx > 0 ? args[fileIdx] : "/var/log/syslog";
      const content = readFileInternal(file, host, state);
      if (content === null) {
        out.push(`grep: ${t("terminal.noSuchFile", { path: file })}`);
      } else {
        const ci = args.includes("-i");
        const needle = ci ? pattern!.toLowerCase() : pattern!;
        const lines = content.split("\n").filter(Boolean);
        out.push(
          ...lines.filter((l) => (ci ? l.toLowerCase() : l).includes(needle)).slice(0, 40)
        );
      }
      break;
    }
    case "nano":
    case "vi":
    case "vim": {
      const path = args[0];
      if (!path) {
        out.push(`${cmd}: fichier manquant`);
        break;
      }
      if (path.startsWith("/etc") && !sudo) {
        out.push(t("terminal.permissionDenied"));
        break;
      }
      const content = readFileInternal(path, host, state);
      if (content === null) {
        out.push(`${cmd}: ${t("terminal.noSuchFile", { path })}`);
        break;
      }
      return { output: [], openEditor: { path, content }, signals };
    }
    case "systemctl": {
      const res = cmdSystemctl(args, host, t, sudo);
      out.push(...res.out);
      Object.assign(signals, res.signals);
      break;
    }
    case "netplan": {
      if (args[0] !== "apply") {
        out.push("netplan: usage: netplan apply");
        break;
      }
      if (!sudo) {
        out.push(t("terminal.permissionDenied"));
        break;
      }
      signals.netplanApplied = true;
      out.push(t("terminal.netplanApplied"));
      break;
    }
    case "dhclient": {
      if (!sudo) {
        out.push(t("terminal.permissionDenied"));
        break;
      }
      const iface = args[0] ?? "eth0";
      if (!host.ifaces[iface]) {
        out.push(`dhclient: ${iface}: interface introuvable`);
        break;
      }
      if (host.ifaces[iface].state !== "up") {
        out.push(t("terminal.dhcpFailed"));
        break;
      }
      if (host.services["systemd-networkd"] !== "active") {
        out.push("dhclient: le service réseau n'est pas actif.");
        out.push(t("terminal.dhcpFailed"));
        break;
      }
      if (!state.world.dhcpRunning) {
        out.push(t("terminal.dhcpFailed"));
        break;
      }
      signals.dhcpRequested = true;
      break;
    }
    case "iptables":
      out.push(...cmdIptables(args, state, sudo));
      break;
    case "show":
      out.push(...cmdShow(args, host, state));
      break;
    case "switchport":
      out.push(...cmdSwitchport(args, host, state, sudo));
      break;
    case "ssh":
      out.push(`ssh: ${t("terminal.sshDenied")}`);
      break;
    case "man":
      out.push(t("terminal.manHint"));
      break;
    case "apt-get":
    case "apt":
      out.push("E: environnement simulé — installation de paquets désactivée.");
      break;
    case "clear":
      signals.clear = true;
      break;
    case "history":
      out.push("(historique géré par l'interface — utilisez la flèche haut)");
      break;
    case "exit":
      out.push("logout");
      break;
    case "sudo":
      out.push("sudo: une commande est attendue. Tapez 'help'.");
      break;
    default:
      out.push(t("terminal.notFound", { cmd }));
  }

  return { output: out, signals };
}

// ---------------- Netplan parser (for `netplan apply`) ----------------
export interface ParsedNetplan {
  ip?: string;
  cidr?: number;
  gw?: string;
  dhcp?: boolean;
  dns?: string[];
  iface?: string;
}

export function parseNetplan(content: string): ParsedNetplan {
  const res: ParsedNetplan = {};
  const addrMatch = content.match(/- (\d+\.\d+\.\d+\.\d+)\/(\d+)/);
  if (addrMatch) {
    res.ip = addrMatch[1];
    res.cidr = parseInt(addrMatch[2], 10);
  }
  const viaMatch = content.match(/via:\s*(\d+\.\d+\.\d+\.\d+)/);
  if (viaMatch) res.gw = viaMatch[1];
  const dhcpMatch = content.match(/dhcp4:\s*(true|false)/);
  if (dhcpMatch) res.dhcp = dhcpMatch[1] === "true";
  const dnsMatch = content.match(/addresses:\s*\[([^\]]+)\]/);
  if (dnsMatch) {
    res.dns = dnsMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d+\.\d+\.\d+\.\d+$/.test(s));
  }
  const ifaceMatch = content.match(/^\s{4}([a-zA-Z0-9_-]+):\s*$/m);
  if (ifaceMatch) res.iface = ifaceMatch[1];
  return res;
}
