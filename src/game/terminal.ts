// ============================================================
// HORIZON CYBER ACADEMY — Terminal simulator
// A coherent shell: every output reflects the live world state
// (interfaces, routes, DNS, services, logs). All network faults
// are reproducible and verifiable through real diagnostic reflexes.
// ============================================================

import type { GameState, HostRuntime } from "./types";
import type { TFn } from "./i18n";
import { DNS_ZONE, INTERNAL_SITES } from "./data/world";

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

export function ipReachable(
  target: string,
  host: HostRuntime,
  state: GameState
): boolean {
  const iface = host.ifaces.eth0 ?? Object.values(host.ifaces)[0];
  if (!iface || iface.state !== "up" || !iface.ip) return false;
  if (target === iface.ip) return true;
  // localhost
  if (target.startsWith("127.")) return true;
  // same subnet: direct L2
  if (iface.cidr && sameSubnet(target, iface.ip, iface.cidr)) return true;
  // cross subnet: needs a reachable gateway that the world actually owns
  if (iface.gw) {
    if (!iface.cidr || !sameSubnet(iface.gw, iface.ip, iface.cidr)) return false;
    // gateway is reachable if it exists on any world host interface
    for (const h of Object.values(state.world.hosts)) {
      for (const i of Object.values(h.ifaces)) {
        if (i.ip === iface.gw) return true;
      }
    }
  }
  return false;
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
  const target = argv[0];
  if (!target) return ["ping: usage: ping [-c count] destination"];
  if (target.startsWith("-")) return ["ping: options non supportées dans le lab"];
  const isName = /[a-zA-Z]/.test(target);
  let ip = target;
  if (isName) {
    const resolved = resolveName(target, host, state);
    if (!resolved) {
      return [
        `ping: ${target}: ${t("terminal.pingDnsFail", { host: target })}`,
      ];
    }
    ip = resolved;
  }
  const out: string[] = [];
  const label = isName ? `${target} (${ip})` : ip;
  out.push(`PING ${label} 56(84) bytes of data.`);
  const reachable = ipReachable(ip, host, state);
  if (reachable) {
    for (let i = 1; i <= 4; i++) {
      const ms = (0.4 + Math.random() * 2.5).toFixed(2);
      out.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=64 time=${ms} ms`);
    }
    out.push(t("terminal.pingStats", { target }));
    out.push(t("terminal.packets", { sent: 4, recv: 4, loss: 0 }));
  } else {
    // distinguish: no local address vs no route vs timeout
    const iface = host.ifaces.eth0 ?? Object.values(host.ifaces)[0];
    if (!iface || iface.state !== "up" || !iface.ip) {
      out.push("connect: Network is unreachable");
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
    const iface = host.ifaces.eth0 ?? Object.values(host.ifaces)[0];
    if (iface && iface.state === "up" && iface.ip) {
      if (iface.gw) out.push(`default via ${iface.gw} dev ${Object.keys(host.ifaces)[0]} proto static`);
      out.push(
        `${networkOf(iface.ip, iface.cidr ?? 24)}/${iface.cidr} dev ${Object.keys(host.ifaces)[0]} proto kernel scope link src ${iface.ip}`
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
  const rawArgv = trimmed.split(/\s+/).filter(Boolean);
  const argv = stripSudo(rawArgv);
  const cmd = argv[0];
  const args = argv.slice(1);
  const signals: TermSignals = { cmd, argv };
  const out: string[] = [];

  if (!trimmed) return { output: [], signals };

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
