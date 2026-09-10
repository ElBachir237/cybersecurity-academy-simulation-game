// ============================================================
// HORIZON — End-to-end engine smoke test (Chapter 1 walkthrough)
// Simulates a real player: lab -> mission -> simulation variants
// Run: npx tsx scripts/smoke.ts
// ============================================================

import { GameEngine } from "../src/game/engine";
import { readHostFile } from "../src/game/terminal";
import type { Profile } from "../src/game/types";

function noLoss(out: string): boolean {
  // FR: "0% de perte" / EN: "0% packet loss" / Windows: "Lost = 0"
  return out.includes("0% de perte") || out.includes("0% packet loss") || out.includes("Lost = 0");
}

function allLoss(out: string): boolean {
  return out.includes("100%") && (out.includes("perte") || out.includes("packet loss") || out.includes("loss"));
}

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  âœ“ ${msg}`);
  } else {
    failures++;
    console.error(`  âœ— FAIL: ${msg}`);
  }
}

const profile: Profile = {
  name: "Test Player",
  avatar: "a1",
  lang: "fr",
  createdAt: Date.now(),
};

function newEngine() {
  return GameEngine.bootstrap(profile);
}

function run(e: GameEngine, host: string, cmd: string): string[] {
  return e.execTerminal(cmd, host);
}

// ---------------- LAB ----------------
console.log("\n[1] LAB c1_lab");
{
  const e = newEngine();
  e.startMission("c1_lab");
  assert(e.state.missions["c1_lab"].status === "active", "lab started");

  run(e, "WS-001", "help");
  run(e, "WS-001", "whoami");
  run(e, "WS-001", "hostname");
  run(e, "WS-001", "ip addr");
  run(e, "WS-001", "ping 192.168.10.1");
  run(e, "WS-001", "ping 10.0.0.10");
  const failPing = run(e, "WS-001", "ping intranet.horizon").join("\n");
  assert(failPing.includes("Ã©chec") || failPing.toLowerCase().includes("dns"), "DNS failure observed before fix");
  run(e, "WS-001", "cat /etc/resolv.conf");
  e.writeFile("WS-001", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  const okPing = run(e, "WS-001", "ping intranet.horizon").join("\n");
  assert(okPing.includes("10.0.0.20") && noLoss(okPing), "intranet reachable after DNS fix");
  run(e, "WS-001", "curl intranet.horizon");

  const lab = e.state.missions["c1_lab"];
  assert(lab.status === "completed", `lab completed (status=${lab.status})`);
  assert(e.state.badges.includes("first_network"), "badge first_network");
  assert(e.state.badges.includes("dns_detective"), "badge dns_detective");
  assert(e.state.missions["c1_mission"].status === "available", "c1_mission unlocked");
}

// ---------------- MISSION ----------------
console.log("\n[2] MISSION c1_mission");
{
  const e = newEngine();
  e.startMission("c1_lab");
  // fast-complete lab
  run(e, "WS-001", "help");
  run(e, "WS-001", "whoami");
  run(e, "WS-001", "hostname");
  run(e, "WS-001", "ip addr");
  run(e, "WS-001", "ping 192.168.10.1");
  run(e, "WS-001", "ping 10.0.0.10");
  run(e, "WS-001", "ping intranet.horizon");
  run(e, "WS-001", "cat /etc/resolv.conf");
  e.writeFile("WS-001", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "WS-001", "ping intranet.horizon");
  assert(e.state.missions["c1_lab"].status === "completed", "lab precondition");

  e.startMission("c1_mission");
  assert(e.state.missions["c1_mission"].status === "active", "mission started");
  // call decision (B is correct)
  e.answerDecision("B");
  assert(e.state.pendingDecision === null, "call answered");
  assert(e.state.reputation > 50, "rep increased");

  // intel
  e.readMail("mail-welcome");
  // diagnose PC-MARIE
  run(e, "PC-MARIE", "ip addr");
  run(e, "PC-MARIE", "cat /var/log/syslog");
  // Marc side decision should appear; answer B (continue diagnosis)
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "PC-MARIE", "sudo systemctl status systemd-networkd");
  run(e, "PC-MARIE", "sudo systemctl restart systemd-networkd");
  run(e, "PC-MARIE", "sudo dhclient eth0");
  const afterFix = run(e, "PC-MARIE", "ip addr").join("\n");
  assert(afterFix.includes("192.168.20.45"), "DHCP lease obtained");
  run(e, "PC-MARIE", "ping 10.0.0.10");
  e.sendChat("itsupport", "PC-MARIE rÃ©parÃ©, bail DHCP obtenu.");

  const m = e.state.missions["c1_mission"];
  assert(m.status === "completed", `mission completed (status=${m.status})`);
  assert(e.state.badges.includes("log_hunter"), "badge log_hunter");
  assert(e.state.missions["c1_sim"].status === "available", "sim unlocked");
}

// ---------------- SIMULATION (all 3 variants) ----------------
for (const variant of ["dns", "gw", "link"] as const) {
  console.log(`\n[3] SIM c1_sim variant=${variant}`);
  const e = newEngine();
  // complete prerequisites quickly
  e.startMission("c1_lab");
  run(e, "WS-001", "help"); run(e, "WS-001", "whoami"); run(e, "WS-001", "hostname");
  run(e, "WS-001", "ip addr"); run(e, "WS-001", "ping 192.168.10.1");
  run(e, "WS-001", "ping 10.0.0.10"); run(e, "WS-001", "ping intranet.horizon");
  run(e, "WS-001", "cat /etc/resolv.conf");
  e.writeFile("WS-001", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "WS-001", "ping intranet.horizon");
  e.startMission("c1_mission");
  e.answerDecision("B");
  e.readMail("mail-welcome");
  run(e, "PC-MARIE", "ip addr");
  run(e, "PC-MARIE", "cat /var/log/syslog");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "PC-MARIE", "sudo systemctl status systemd-networkd");
  run(e, "PC-MARIE", "sudo systemctl restart systemd-networkd");
  run(e, "PC-MARIE", "sudo dhclient eth0");
  run(e, "PC-MARIE", "ping 10.0.0.10");
  e.sendChat("itsupport", "rÃ©parÃ©");

  e.startMission("c1_sim", variant);
  const sim = e.state.missions["c1_sim"];
  assert(sim.variant === variant, `variant is ${variant}`);
  // answer call A (correct)
  e.answerDecision("A");
  // diagnosis
  run(e, "PC-PAUL", "ip addr");
  run(e, "PC-PAUL", "ip route");
  run(e, "PC-PAUL", "cat /etc/resolv.conf");
  run(e, "PC-PAUL", "ping 10.0.0.10");

  if (variant === "dns") {
    e.writeFile("PC-PAUL", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  } else if (variant === "gw") {
    // player opens the editor on the CURRENT (generated) netplan and fixes the gateway
    const current = readHostFile(
      "/etc/netplan/01-netcfg.yaml",
      e.state.world.hosts["PC-PAUL"],
      e.state
    ) ?? "";
    e.writeFile(
      "PC-PAUL",
      "/etc/netplan/01-netcfg.yaml",
      current.replace("192.168.30.254", "192.168.30.1")
    );
    run(e, "PC-PAUL", "sudo netplan apply");
  } else {
    run(e, "PC-PAUL", "sudo ip link set eth0 up");
  }
  const verify = run(e, "PC-PAUL", "ping 10.0.0.10").join("\n");
  assert(noLoss(verify), `[${variant}] connectivity verified`);
  e.sendChat("itsupport", "rapport: incident rÃ©solu");
  const s = e.state.missions["c1_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(e.state.certificates.some((c) => c.titleKey === "Cyber Explorer"), `[${variant}] certificate issued`);
  assert(e.state.titleKey === "junior_tech", `[${variant}] title junior_tech (got ${e.state.titleKey})`);
  assert(e.state.debrief !== null, `[${variant}] debrief available`);
}

// ---------------- ERROR PATH ----------------
console.log("\n[4] ERROR PATH — restarting healthy DHCP server");
{
  const e = newEngine();
  e.startMission("c1_lab");
  run(e, "WS-001", "help"); run(e, "WS-001", "whoami"); run(e, "WS-001", "hostname");
  run(e, "WS-001", "ip addr"); run(e, "WS-001", "ping 192.168.10.1");
  run(e, "WS-001", "ping 10.0.0.10"); run(e, "WS-001", "ping intranet.horizon");
  run(e, "WS-001", "cat /etc/resolv.conf");
  e.writeFile("WS-001", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "WS-001", "ping intranet.horizon");
  e.startMission("c1_mission");
  e.answerDecision("B");
  // premature action: restart the HQ DHCP server
  run(e, "RTR-HQ", "sudo systemctl restart isc-dhcp-server");
  const m = e.state.missions["c1_mission"];
  assert(m.errors >= 1 && m.errorKeys.includes("dhcp_restart"), "error recorded");
  assert(e.state.world.financeOutage === true, "finance outage triggered");
  assert(e.state.world.tickets.some((t) => t.id === "IT-1043"), "critical ticket created");
  assert(e.state.learning !== null, "learning modal shown");
  // close learning and still complete the mission
  e.closeLearning();
  e.readMail("mail-welcome");
  run(e, "PC-MARIE", "ip addr");
  run(e, "PC-MARIE", "cat /var/log/syslog");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "PC-MARIE", "sudo systemctl status systemd-networkd");
  run(e, "PC-MARIE", "sudo systemctl restart systemd-networkd");
  run(e, "PC-MARIE", "sudo dhclient eth0");
  run(e, "PC-MARIE", "ping 10.0.0.10");
  e.sendChat("itsupport", "rÃ©parÃ©");
  assert(e.state.missions["c1_mission"].status === "completed", "mission still completable after error");
  assert(e.state.missions["c1_mission"].score < 100, "score penalized");
}

// ---------------- SAVE ROUNDTRIP ----------------
console.log("\n[5] SAVE ROUNDTRIP");
{
  const e = newEngine();
  e.startMission("c1_lab");
  run(e, "WS-001", "help"); run(e, "WS-001", "whoami"); run(e, "WS-001", "hostname");
  run(e, "WS-001", "ip addr"); run(e, "WS-001", "ping 192.168.10.1");
  run(e, "WS-001", "ping 10.0.0.10"); run(e, "WS-001", "ping intranet.horizon");
  run(e, "WS-001", "cat /etc/resolv.conf");
  e.writeFile("WS-001", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "WS-001", "ping intranet.horizon");
  const snap = JSON.parse(JSON.stringify(e.state));
  const e2 = new GameEngine(snap);
  assert(e2.state.badges.length === e.state.badges.length, "badges survive save");
  assert(e2.state.missions["c1_lab"].status === "completed", "mission status survives save");
  assert(e2.state.world.hosts["WS-001"].dns.includes("10.0.0.10"), "world state survives save");
}

function nourNetplan(ip = "192.168.40.24", cidr = 26, gw = "192.168.40.1"): string {
  return [
    "network:",
    "  version: 2",
    "  renderer: networkd",
    "  ethernets:",
    "    eth0:",
    "      dhcp4: false",
    "      addresses:",
    `        - ${ip}/${cidr}`,
    "      routes:",
    "        - to: default",
    `          via: ${gw}`,
    "      nameservers:",
    "        addresses: [10.0.0.10]",
    "",
  ].join("\n");
}

function fixNourPlan(e: GameEngine) {
  e.writeFile("PC-NOUR", "/etc/netplan/01-netcfg.yaml", nourNetplan());
  run(e, "PC-NOUR", "sudo netplan apply");
}

function completeChapter1(e: GameEngine) {
  e.startMission("c1_lab");
  run(e, "WS-001", "help");
  run(e, "WS-001", "whoami");
  run(e, "WS-001", "hostname");
  run(e, "WS-001", "ip addr");
  run(e, "WS-001", "ping 192.168.10.1");
  run(e, "WS-001", "ping 10.0.0.10");
  run(e, "WS-001", "ping intranet.horizon");
  run(e, "WS-001", "cat /etc/resolv.conf");
  e.writeFile("WS-001", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "WS-001", "ping intranet.horizon");
  e.startMission("c1_mission");
  e.answerDecision("B");
  e.readMail("mail-welcome");
  run(e, "PC-MARIE", "ip addr");
  run(e, "PC-MARIE", "cat /var/log/syslog");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "PC-MARIE", "sudo systemctl status systemd-networkd");
  run(e, "PC-MARIE", "sudo systemctl restart systemd-networkd");
  run(e, "PC-MARIE", "sudo dhclient eth0");
  run(e, "PC-MARIE", "ping 10.0.0.10");
  e.sendChat("itsupport", "rÃ©parÃ©");
  e.startMission("c1_sim", "dns");
  e.answerDecision("A");
  run(e, "PC-PAUL", "ip addr");
  run(e, "PC-PAUL", "ip route");
  e.writeFile("PC-PAUL", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "PC-PAUL", "ping 10.0.0.10");
  e.sendChat("itsupport", "rapport: incident rÃ©solu");
}

function completeChapter2(e: GameEngine) {
  completeChapter1(e);
  e.startMission("c2_lab");
  e.openApp("network");
  e.dispatchAction("subnet-calc", {
    count: 1,
    ip: "192.168.40.0",
    cidr: 26,
    network: "192.168.40.0",
    usable: 62,
  });
  e.startMission("c2_mission");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c2_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "PC-NOUR", "ip addr");
  if (e.state.pendingDecision) e.answerDecision("B");
  e.openApp("network");
  fixNourPlan(e);
  run(e, "PC-NOUR", "ping 192.168.40.1");
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "VLAN 40 ok");
  e.startMission("c2_sim", "mask");
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c2_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  run(e, "PC-NOUR", "ip addr");
  fixNourPlan(e);
  run(e, "PC-NOUR", "ping 192.168.40.1");
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "rapport: plan VLAN 40 rÃ©tabli");
}

function completeChapter2Ready(): GameEngine {
  const e = newEngine();
  completeChapter2(e);
  return e;
}

function completeC3Lab(e: GameEngine) {
  e.startMission("c3_lab");
  run(e, "WS-001", "sudo iptables -L");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "sudo iptables -D FW-LAB");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
}

function completeC3Port(e: GameEngine) {
  e.startMission("c3_port");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c3_port.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "SW-01", "show vlan");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "SW-01", "sudo switchport Gi0/14 vlan 40");
  run(e, "PC-NOUR", "ping 192.168.40.1");
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "Gi0/14 VLAN 40");
}

function completeC3Nat(e: GameEngine) {
  e.startMission("c3_nat");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c3_nat.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo iptables -L");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo iptables -D FW-NAT");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
  e.sendChat("itsupport", "FW-NAT retirÃ©");
}

function completeC3ThroughNat(e: GameEngine) {
  completeC3Lab(e);
  completeC3Port(e);
  completeC3Nat(e);
}

function completeC3Mission(e: GameEngine) {
  e.startMission("c3_mission");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c3_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo iptables -L");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo iptables -D FW-VENDOR");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
  e.sendChat("itsupport", "FORWARD ok");
}

function completeChapter3(e: GameEngine) {
  completeC3ThroughNat(e);
  completeC3Mission(e);
  e.startMission("c3_sim", "any");
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c3_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo iptables -L");
  run(e, "WS-001", "sudo iptables -D FW-HOLE");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
  e.sendChat("itsupport", "rapport: trou FORWARD fermé");
}

function completeChapter3Ready(): GameEngine {
  const e = completeChapter2Ready();
  completeChapter3(e);
  return e;
}

function completeC4Lab(e: GameEngine) {
  e.startMission("c4_lab");
  run(e, "PC-WIN", "help");
  run(e, "PC-WIN", "ipconfig");
  run(e, "PC-WIN", "ping 192.168.10.1");
  run(e, "PC-WIN", "ping 10.0.0.10");
  run(e, "PC-WIN", "ping intranet.horizon");
  run(e, "PC-WIN", "ipconfig /all");
  run(e, "PC-WIN", "netsh interface ipv4 set dnsservers name=Ethernet static 10.0.0.10");
  run(e, "PC-WIN", "ping intranet.horizon");
}

function completeC4Wifi(e: GameEngine) {
  e.startMission("c4_wifi");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c4_wifi.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "AP-01", "info");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "AP-01", "set-ssid HORIZON-CORP");
  run(e, "AP-01", "set-vlan 10");
  run(e, "PC-AMINA", "netsh wlan connect name=HORIZON-CORP");
  run(e, "PC-AMINA", "ping intranet.horizon");
  e.sendChat("itsupport", "SSID CORP VLAN 10");
}

function completeC4Desk(e: GameEngine) {
  e.startMission("c4_desk");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c4_desk.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "PC-AMINA", "net user amina");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "PC-AMINA", "net user amina /active:yes");
  run(e, "PC-AMINA", "net start spooler");
  run(e, "PC-AMINA", "ping 192.168.10.88");
  e.sendChat("itsupport", "compte et spooler ok");
}

function completeC4Sim(e: GameEngine) {
  e.startMission("c4_sim", "link");
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c4_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  run(e, "PC-WIN", "netsh interface set interface name=Ethernet admin=ENABLED");
  run(e, "PC-WIN", "ping intranet.horizon");
  e.sendChat("itsupport", "rapport: PC-WIN ok");
}

function completeChapter4(e: GameEngine) {
  completeC4Lab(e);
  completeC4Wifi(e);
  completeC4Desk(e);
  completeC4Sim(e);
}

function completeChapter4Ready(): GameEngine {
  const e = completeChapter3Ready();
  completeChapter4(e);
  return e;
}

function completeC5Lab(e: GameEngine) {
  e.startMission("c5_lab");
  run(e, "SRV-WEB", "hostname");
  run(e, "SRV-WEB", "sudo systemctl status nginx");
  run(e, "SRV-WEB", "journalctl -u nginx");
  run(e, "SRV-WEB", "sudo systemctl start nginx");
  run(e, "WS-001", "curl intranet.horizon");
}

function completeC5Web(e: GameEngine) {
  e.startMission("c5_web");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c5_web.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "WS-001", "dig rh.horizon.local");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "DNS-01", "sudo nsupdate add rh.horizon.local A 10.0.0.20");
  run(e, "SRV-WEB", "sudo ln -s /etc/nginx/sites-available/rh.horizon.local /etc/nginx/sites-enabled/rh.horizon.local");
  run(e, "WS-001", "curl rh.horizon.local");
  e.sendChat("itsupport", "rh.horizon.local 200");
}

function completeC5Ad(e: GameEngine) {
  e.startMission("c5_ad");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c5_ad.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "SRV-DC", "samba-tool user list");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "SRV-DC", "samba-tool user create jmorel Horizon!2024");
  run(e, "SRV-DC", "samba-tool user show jmorel");
  e.sendChat("itsupport", "compte jmorel cree");
}

function completeC5Sim(e: GameEngine) {
  e.startMission("c5_sim", "nginx");
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c5_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  run(e, "SRV-WEB", "sudo systemctl start nginx");
  run(e, "WS-001", "curl intranet.horizon");
  e.sendChat("itsupport", "rapport: incident systemes clos");
}

function completeChapter5Ready(): GameEngine {
  const e = completeChapter4Ready();
  completeC5Lab(e);
  completeC5Web(e);
  completeC5Ad(e);
  completeC5Sim(e);
  return e;
}

function completeC6Lab(e: GameEngine) {
  e.startMission("c6_lab");
  run(e, "FW-PFS", "help");
  run(e, "FW-PFS", "pfctl -sr");
  run(e, "FW-PFS", "easyrule delete wan PF-HOLE");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
}

function completeC6Mt(e: GameEngine) {
  e.startMission("c6_mt");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c6_mt.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "RTR-BR", "/ip address print");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "RTR-BR", "/ip route print");
  run(e, "RTR-BR", "/ip route add dst-address=0.0.0.0/0 gateway=172.16.0.1");
  run(e, "RTR-BR", "/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade");
  run(e, "PC-LEA", "ping 10.0.0.20");
  e.sendChat("itsupport", "filiale retablie");
}

function completeC6Unifi(e: GameEngine) {
  e.startMission("c6_unifi");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.c6_unifi.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "GW-UDM", "info");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "GW-UDM", "show firewall");
  run(e, "GW-UDM", "set-guest-isolation on");
  run(e, "PC-PAUL", "ping 192.168.10.24");
  e.sendChat("itsupport", "isolation guest on");
}

function completeC6Sim(e: GameEngine) {
  e.startMission("c6_sim", "pf");
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c6_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  run(e, "FW-PFS", "easyrule delete wan PF-HOLE");
  e.sendChat("itsupport", "rapport: incident reseau clos");
}

function completeChapter6Ready(): GameEngine {
  const e = completeChapter5Ready();
  completeC6Lab(e);
  completeC6Mt(e);
  completeC6Unifi(e);
  completeC6Sim(e);
  return e;
}

function buildLabRack(e: GameEngine) {
  for (const kind of ["pfsense", "switch", "server", "pc", "ap"] as const) {
    e.dispatchAction("workshop-place", { kind });
  }
  e.dispatchAction("workshop-cable", { a: "LAB-FW", b: "LAB-SW" });
  e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-WEB" });
  e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-PC" });
  e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-AP" });
}

function completeE5Lab(e: GameEngine) {
  e.startMission("e5_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  buildLabRack(e);
}

function completeE5Sim(e: GameEngine) {
  e.startMission("e5_sim", "cable");
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.e5_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-WEB" });
  run(e, "LAB-PC", "curl lab.horizon.local");
  e.sendChat("itsupport", "rapport: atelier clos");
}

function completeChapter7Ready(): GameEngine {
  const e = completeChapter6Ready();
  completeE5Lab(e);
  completeE5Site(e);
  completeE5Sim(e);
  return e;
}

function completeE5Site(e: GameEngine) {
  e.startMission("e5_site");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e5_site.mailTicketSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "LAB-FW", "ifconfig em1 10.20.0.1/24");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "LAB-WEB", "ip addr add 10.20.0.20/24 dev eth0");
  run(e, "LAB-PC", "ip addr add 10.20.0.24/24 dev eth0");
  run(e, "LAB-WEB", "sudo nsupdate add lab.horizon.local A 10.20.0.20");
  run(e, "LAB-WEB", "sudo ln -s /etc/nginx/sites-available/lab.horizon.local /etc/nginx/sites-enabled/lab.horizon.local");
  run(e, "LAB-PC", "curl lab.horizon.local");
  e.sendChat("itsupport", "lab.horizon.local 200");
}

function triageNoise(e: GameEngine) {
  for (const a of e.state.world.socAlerts ?? []) {
    if (!a.truePositive) e.dispatchAction("soc-fp", { id: a.id });
  }
}

function completeE6Lab(e: GameEngine) {
  e.startMission("e6_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  triageNoise(e);
  run(e, "SRV-WEB", "journalctl -u sshd");
  e.dispatchAction("soc-escalate", { id: "SOC-8009" });
  e.sendChat("soc", "SSH-BRUTE confirme");
}

function completeE6Phish(e: GameEngine) {
  e.startMission("e6_phish");
  const phish = e.state.mails.find((m) => m.subjectKey === "missions.e6_phish.mailSubject")!;
  e.readMail(phish.id);
  e.answerDecision("A");
  e.dispatchAction("mail-report-phish", { mailId: phish.id });
  e.dispatchAction("soc-escalate", { id: "SOC-8101" });
  e.sendChat("soc", "phishing signale");
}

function completeE6Sim(e: GameEngine) {
  e.startMission("e6_sim", "noise");
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.e6_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  triageNoise(e);
  e.sendChat("soc", "rapport L1");
}

function completeChapter8Ready(): GameEngine {
  const e = completeChapter7Ready();
  completeE6Lab(e);
  completeE6Phish(e);
  completeE6Sim(e);
  return e;
}

const SAMPLE_HASH = "a4f3c8e19b2d7e6a1c0f5d8b3e7a9124c6d0e8f1a2b3c4d5e6f708192a3b4c5d";
const SAMPLE_FILE = "/opt/horizon/sandbox/sample.quarantine";

function completeE7Lab(e: GameEngine) {
  e.startMission("e7_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", `sha256sum ${SAMPLE_FILE}`);
  run(e, "WS-001", `strings ${SAMPLE_FILE}`);
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  e.sendChat("soc", "PC-PAUL isole, hash lu");
}

function completeE7Ioc(e: GameEngine) {
  e.startMission("e7_ioc");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e7_ioc.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "PC-PAUL", "grep beacon /var/log/syslog");
  run(e, "WS-001", `ioc add ${SAMPLE_HASH}`);
  e.sendChat("soc", "IOC en watchlist");
}

function completeE7Sim(e: GameEngine) {
  e.startMission("e7_sim", "hash");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e7_sim.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "WS-001", `sha256sum ${SAMPLE_FILE}`);
  e.sendChat("soc", "hash confirme");
}

function completeChapter9Ready(): GameEngine {
  const e = completeChapter8Ready();
  completeE7Lab(e);
  completeE7Ioc(e);
  completeE7Sim(e);
  return e;
}

function completeE8Lab(e: GameEngine) {
  e.startMission("e8_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  run(e, "PC-MARIE", "ping 10.0.0.10");
  e.sendChat("soc", "Paul isole, Marie DNS OK");
}

function completeE8Ir(e: GameEngine) {
  e.startMission("e8_ir");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e8_ir.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "PC-PAUL", "grep beacon /var/log/syslog");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  run(e, "PC-MARIE", "ping 10.0.0.10");
  e.sendChat("soc", "containment OK, paie intacte");
}

function completeE8Sim(e: GameEngine) {
  e.startMission("e8_sim", "isolate");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e8_sim.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  e.sendChat("soc", "rapport IR");
}

function completeChapter10Ready(): GameEngine {
  const e = completeChapter9Ready();
  completeE8Lab(e);
  completeE8Ir(e);
  completeE8Sim(e);
  return e;
}

const TIMELINE_FILE = "/opt/horizon/evidence/paul.timeline";
const EVIDENCE_HASH = "c8d1e4f70a2b3958671c0d4e9f2a5b8c3d6e1f4a7b0c2d5e8f1a4b7c0d3e6f9a";

function completeE9Lab(e: GameEngine) {
  e.startMission("e9_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo acquire PC-PAUL");
  run(e, "WS-001", `cat ${TIMELINE_FILE}`);
  e.sendChat("soc", "timeline lue, acces horiz0n");
}

function completeE9Scope(e: GameEngine) {
  e.startMission("e9_scope");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e9_scope.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "PC-PAUL", "grep horiz0n /var/log/syslog");
  run(e, "WS-001", "sudo acquire PC-PAUL");
  e.sendChat("soc", "scope Paul only, Marie hors chaine");
}

function completeE9Sim(e: GameEngine) {
  e.startMission("e9_sim", "auth");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e9_sim.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "PC-PAUL", "grep horiz0n /var/log/syslog");
  e.sendChat("soc", "rapport DFIR");
}

function completeChapter11Ready(): GameEngine {
  const e = completeChapter10Ready();
  completeE9Lab(e);
  completeE9Scope(e);
  completeE9Sim(e);
  return e;
}

function mailAndCall(e: GameEngine, subjectKey: string) {
  const mail = e.state.mails.find((m) => m.subjectKey === subjectKey)!;
  e.readMail(mail.id);
  e.answerDecision("A");
}

function completeE10Lab(e: GameEngine) {
  e.startMission("e10_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  run(e, "WS-001", "sudo nginx autoindex off");
  e.sendChat("soc", "vitrine durcie");
}

function completeE10Web(e: GameEngine) {
  e.startMission("e10_web");
  mailAndCall(e, "missions.e10_web.mailSubject");
  run(e, "WS-001", "sudo nginx ssl_certificate /etc/nginx/ssl/astral.crt");
  run(e, "WS-001", "sudo nginx proxy_pass http://127.0.0.1:8080");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  e.sendChat("soc", "tls proxy hsts");
}

function completeE10Sim(e: GameEngine, variant = "headers") {
  e.startMission("e10_sim", variant);
  mailAndCall(e, "missions.e10_sim.mailSubject");
  if (variant === "headers") {
    run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
    run(e, "WS-001", "sudo nginx autoindex off");
  } else if (variant === "tls") {
    run(e, "WS-001", "sudo nginx ssl_certificate /etc/nginx/ssl/astral.crt");
  } else {
    run(e, "WS-001", "sudo nginx proxy_pass http://127.0.0.1:8080");
  }
  e.sendChat("soc", "rapport vitrine");
}

function completeChapter12Ready(): GameEngine {
  const e = completeChapter11Ready();
  completeE10Lab(e);
  completeE10Web(e);
  completeE10Sim(e);
  return e;
}

function completeE11Lab(e: GameEngine) {
  e.startMission("e11_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "hzcloud sg revoke");
  e.sendChat("soc", "sg ferme");
}

function completeE11Iam(e: GameEngine) {
  e.startMission("e11_iam");
  mailAndCall(e, "missions.e11_iam.mailSubject");
  run(e, "WS-001", "hzcloud iam detach");
  run(e, "WS-001", "hzcloud secret rotate");
  e.sendChat("soc", "iam et secret");
}

function completeE11Sim(e: GameEngine, variant = "sg") {
  e.startMission("e11_sim", variant);
  mailAndCall(e, "missions.e11_sim.mailSubject");
  if (variant === "sg") run(e, "WS-001", "hzcloud sg revoke");
  else if (variant === "iam") run(e, "WS-001", "hzcloud iam detach");
  else run(e, "WS-001", "hzcloud secret rotate");
  e.sendChat("soc", "rapport orbit");
}

function completeChapter13Ready(): GameEngine {
  const e = completeChapter12Ready();
  completeE11Lab(e);
  completeE11Iam(e);
  completeE11Sim(e);
  return e;
}

function completeE12Lab(e: GameEngine) {
  e.startMission("e12_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo bastion enable");
  run(e, "WS-001", "sudo ot isolate");
  e.sendChat("soc", "bastion ot");
}

function completeE12Zt(e: GameEngine) {
  e.startMission("e12_zt");
  mailAndCall(e, "missions.e12_zt.mailSubject");
  run(e, "WS-001", "sudo bastion enable");
  run(e, "WS-001", "sudo zt enable");
  e.sendChat("soc", "zt bastion");
}

function completeE12Sim(e: GameEngine, variant = "bastion") {
  e.startMission("e12_sim", variant);
  mailAndCall(e, "missions.e12_sim.mailSubject");
  if (variant === "bastion") run(e, "WS-001", "sudo bastion enable");
  else if (variant === "ot") run(e, "WS-001", "sudo ot isolate");
  else run(e, "WS-001", "sudo zt enable");
  e.sendChat("soc", "rapport bastion");
}

function completeChapter14Ready(): GameEngine {
  const e = completeChapter13Ready();
  completeE12Lab(e);
  completeE12Zt(e);
  completeE12Sim(e);
  return e;
}

function completeE13Lab(e: GameEngine) {
  e.startMission("e13_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "hzpolicy risk close ASTRAL-R1");
  run(e, "WS-001", "hzpolicy sign MANDAT-15");
  e.sendChat("itsupport", "risque clos politique signee");
}

function completeE13Audit(e: GameEngine) {
  e.startMission("e13_audit");
  mailAndCall(e, "missions.e13_audit.mailSubject");
  run(e, "WS-001", "hzpolicy supplier hold VENDOR-X");
  run(e, "WS-001", "hzpolicy sign MANDAT-15");
  e.sendChat("itsupport", "fournisseur hold");
}

function completeE13Sim(e: GameEngine, variant = "risk") {
  e.startMission("e13_sim", variant);
  mailAndCall(e, "missions.e13_sim.mailSubject");
  if (variant === "risk") run(e, "WS-001", "hzpolicy risk close ASTRAL-R1");
  else if (variant === "policy") run(e, "WS-001", "hzpolicy sign MANDAT-15");
  else run(e, "WS-001", "hzpolicy supplier hold VENDOR-X");
  e.sendChat("itsupport", "rapport mandat");
}

function completeChapter15Ready(): GameEngine {
  const e = completeChapter14Ready();
  completeE13Lab(e);
  completeE13Audit(e);
  completeE13Sim(e);
  return e;
}

function completeE14Lab(e: GameEngine) {
  e.startMission("e14_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  run(e, "WS-001", "sudo nginx autoindex off");
  e.sendChat("soc", "apogee contain");
}

function completeE14Cross(e: GameEngine) {
  e.startMission("e14_cross");
  mailAndCall(e, "missions.e14_cross.mailSubject");
  run(e, "WS-001", "hzcloud sg revoke");
  run(e, "WS-001", "sudo bastion enable");
  run(e, "WS-001", "sudo zt enable");
  e.sendChat("soc", "sg bastion zt");
}

function completeE14Sim(e: GameEngine, variant = "contain") {
  e.startMission("e14_sim", variant);
  mailAndCall(e, "missions.e14_sim.mailSubject");
  if (variant === "contain") run(e, "WS-001", "sudo edr isolate PC-PAUL");
  else if (variant === "portal") {
    run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
    run(e, "WS-001", "sudo nginx autoindex off");
  } else run(e, "WS-001", "hzpolicy sign MANDAT-15");
  e.sendChat("soc", "rapport apogee");
}

console.log("\n[6] CHAPTER 2 LAB c2_lab");
{
  const e = newEngine();
  completeChapter1(e);
  assert(e.state.missions["c2_lab"].status === "available", "c2_lab unlocked after chapter 1");
  e.startMission("c2_lab");
  e.openApp("network");
  e.dispatchAction("subnet-calc", {
    count: 1,
    ip: "192.168.40.0",
    cidr: 26,
    network: "192.168.40.0",
    usable: 62,
  });
  assert(e.state.missions["c2_lab"].status === "completed", `c2_lab completed (status=${e.state.missions["c2_lab"].status})`);
  assert(e.state.missions["c2_mission"].status === "available", "c2_mission unlocked");
}

console.log("\n[7] CHAPTER 2 MISSION c2_mission");
{
  const e = newEngine();
  completeChapter1(e);
  e.startMission("c2_lab");
  e.openApp("network");
  e.dispatchAction("subnet-calc", { count: 1, ip: "192.168.40.0", cidr: 26, network: "192.168.40.0", usable: 62 });
  e.startMission("c2_mission");
  assert(e.state.activeMissionId === "c2_mission", "c2_mission started");
  assert(
    e.state.mails.some((m) => m.subjectKey === "missions.c2_mission.mailTicketSubject"),
    "IT-2101 mail is in the inbox"
  );
  assert(e.state.activeWindow === "mail", "mail app opens so the ticket is visible");
  assert(e.state.world.hosts["PC-NOUR"]?.ifaces.eth0?.ip === "192.168.10.80", "Nour starts on cloned VLAN 10 address");
  assert(e.state.world.hosts["RTR-HQ"]?.ifaces.eth4?.ip === "192.168.40.1", "VLAN 40 gateway exists on RTR-HQ");
  assert(e.state.pendingDecision === null, "phone call waits until the mail is read");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c2_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  assert(e.state.pendingDecision?.id === "c2m_call", "Nour calls after the ticket is read");
  e.answerDecision("A");
  run(e, "PC-NOUR", "ip addr");
  if (e.state.pendingDecision) e.answerDecision("B");
  e.openApp("network");
  const before = run(e, "PC-NOUR", "ping 10.0.0.10").join("\n");
  assert(noLoss(before), "wrong VLAN still pings DNS — that is the trap");
  fixNourPlan(e);
  const eth = e.state.world.hosts["PC-NOUR"]?.ifaces.eth0;
  assert(eth?.ip === "192.168.40.24" && eth.cidr === 26 && eth.gw === "192.168.40.1", "plan applied");
  const gwPing = run(e, "PC-NOUR", "ping 192.168.40.1").join("\n");
  assert(noLoss(gwPing), "floor gateway reachable");
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "PC-NOUR sur VLAN 40 192.168.40.24/26");
  assert(e.state.missions["c2_mission"].status === "completed", `c2_mission completed (status=${e.state.missions["c2_mission"].status})`);
  assert(e.state.badges.includes("subnet_planner"), "badge subnet_planner");
  assert(e.state.missions["c2_sim"].status === "available", "c2_sim unlocked");
}

console.log("\n[8] CHAPTER 2 ERROR — leave Nour on VLAN 10");
{
  const e = newEngine();
  completeChapter1(e);
  e.startMission("c2_lab");
  e.openApp("network");
  e.dispatchAction("subnet-calc", { count: 1, ip: "192.168.40.0", cidr: 26, network: "192.168.40.0", usable: 62 });
  e.startMission("c2_mission");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c2_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "PC-NOUR", "ip addr");
  assert(e.state.pendingDecision?.id === "c2m_leave", "segmentation decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["c2_mission"].errorKeys.includes("left_wrong_vlan"), "error recorded");
  assert(e.state.world.tickets.some((t) => t.id === "IT-2102"), "IT-2102 opened");
  e.openApp("network");
  fixNourPlan(e);
  run(e, "PC-NOUR", "ping 192.168.40.1");
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "corrigÃ© malgrÃ© tout");
  assert(e.state.missions["c2_mission"].status === "completed", "mission still completable");
  assert(e.state.missions["c2_mission"].score < 100, "score penalized");
}

for (const variant of ["mask", "gw", "ip"] as const) {
  console.log(`\n[9] SIM c2_sim variant=${variant}`);
  const e = newEngine();
  completeChapter1(e);
  e.startMission("c2_lab");
  e.openApp("network");
  e.dispatchAction("subnet-calc", { count: 1, ip: "192.168.40.0", cidr: 26, network: "192.168.40.0", usable: 62 });
  e.startMission("c2_mission");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c2_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "PC-NOUR", "ip addr");
  if (e.state.pendingDecision) e.answerDecision("B");
  e.openApp("network");
  fixNourPlan(e);
  run(e, "PC-NOUR", "ping 192.168.40.1");
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "VLAN 40 ok");

  e.startMission("c2_sim", variant);
  assert(e.state.missions["c2_sim"].variant === variant, `variant is ${variant}`);
  assert(
    e.state.mails.some((m) => m.subjectKey === "missions.c2_sim.mailSubject"),
    `[${variant}] exam mail is in the inbox`
  );
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c2_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  run(e, "PC-NOUR", "ip addr");
  run(e, "PC-NOUR", "ip route");
  run(e, "PC-NOUR", "cat /etc/netplan/01-netcfg.yaml");
  fixNourPlan(e);
  const verify = run(e, "PC-NOUR", "ping 192.168.40.1").join("\n");
  assert(noLoss(verify), `[${variant}] gateway verified`);
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "rapport: plan VLAN 40 rÃ©tabli");
  const s = e.state.missions["c2_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Network Foundations"),
    `[${variant}] Network Foundations certificate`
  );
  assert(e.state.debrief !== null, `[${variant}] debrief available`);
  assert(e.state.chapter >= 3, `[${variant}] chapter advanced`);
}

console.log("\n[10] OLD SAVE — missing c2_mission runtime still starts and gets mail");
{
  const e = newEngine();
  completeChapter1(e);
  e.startMission("c2_lab");
  e.openApp("network");
  e.dispatchAction("subnet-calc", { count: 1, ip: "192.168.40.0", cidr: 26, network: "192.168.40.0", usable: 62 });
  delete e.state.missions["c2_mission"];
  delete e.state.missions["c2_sim"];
  e.startMission("c2_mission");
  assert(e.state.activeMissionId === "c2_mission", "hydrated runtime starts");
  assert(
    e.state.mails.some((m) => m.subjectKey === "missions.c2_mission.mailTicketSubject"),
    "ticket mail created on hydrated start"
  );
  assert(e.state.activeWindow === "mail", "mail workspace opened");
}

console.log("\n[11] CHAPTER 1 still reaches DNS after firewall default");
{
  const e = newEngine();
  const dns = run(e, "WS-001", "ping 10.0.0.10").join("\n");
  assert(noLoss(dns), "office to DNS allowed by FW-CORE");
  const finance = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(allLoss(finance), "office to Finance denied by default");
}

console.log("\n[12] CHAPTER 3 LAB c3_lab");
{
  const e = completeChapter2Ready();
  assert(e.state.missions["c3_lab"].status === "available", "c3_lab unlocked after chapter 2");
  e.startMission("c3_lab");
  assert(e.state.activeMissionId === "c3_lab", "c3_lab started");
  assert(e.state.activeWindow === "terminal", "lab opens the terminal, not mail");
  assert(
    e.state.world.fwRules.some((r) => r.id === "FW-LAB"),
    "lab hole FW-LAB is present"
  );
  const listed = run(e, "WS-001", "sudo iptables -L").join("\n");
  assert(listed.includes("FW-LAB"), "iptables -L shows FW-LAB");
  const holePing = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(noLoss(holePing), "hole lets office ping Marie");
  const del = run(e, "WS-001", "sudo iptables -D FW-LAB").join("\n");
  assert(del.includes("deleted"), "FW-LAB deleted");
  const closed = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(allLoss(closed), "Finance ping times out after delete");
  const dns = run(e, "WS-001", "ping 10.0.0.10").join("\n");
  assert(noLoss(dns), "DNS still reachable");
  assert(e.state.missions["c3_lab"].status === "completed", `c3_lab completed (status=${e.state.missions["c3_lab"].status})`);
  assert(e.state.missions["c3_port"].status === "available", "c3_port unlocked");
}

console.log("\n[12b] OLD SAVE — missing c3_lab runtime still starts after chapter 2");
{
  const e = completeChapter2Ready();
  delete e.state.missions["c3_lab"];
  delete e.state.missions["c3_port"];
  delete e.state.missions["c3_nat"];
  delete e.state.missions["c3_mission"];
  delete e.state.missions["c3_sim"];
  e.startMission("c3_lab");
  assert(e.state.activeMissionId === "c3_lab", "c3_lab starts from a save that lacked chapter 3 runtimes");
}

console.log("\n[13] CHAPTER 3 PORT c3_port");
{
  const e = completeChapter2Ready();
  completeC3Lab(e);
  e.startMission("c3_port");
  assert(e.state.activeMissionId === "c3_port", "c3_port started");
  assert(e.state.activeWindow === "mail", "mail opens for the switch ticket");
  assert(e.state.pendingDecision === null, "call waits until mail is read");
  assert(
    e.state.world.switchPorts.find((p) => p.id === "Gi0/14")?.vlan === 10,
    "Nour's port starts on VLAN 10"
  );
  const isolated = run(e, "PC-NOUR", "ping 192.168.40.1").join("\n");
  assert(allLoss(isolated), "correct IP on wrong VLAN cannot reach floor gateway");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c3_port.mailTicketSubject")!;
  e.readMail(ticket.id);
  assert(e.state.pendingDecision?.id === "c3p_call", "Nour calls after the ticket is read");
  e.answerDecision("A");
  const shown = run(e, "SW-01", "show interfaces status").join("\n");
  assert(shown.includes("Gi0/14"), "switch port table lists Gi0/14");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "SW-01", "sudo switchport Gi0/14 vlan 40");
  assert(e.state.world.switchPorts.find((p) => p.id === "Gi0/14")?.vlan === 40, "port moved to VLAN 40");
  const gw = run(e, "PC-NOUR", "ping 192.168.40.1").join("\n");
  assert(noLoss(gw), "floor gateway reachable after VLAN fix");
  run(e, "PC-NOUR", "ping 10.0.0.10");
  e.sendChat("itsupport", "port VLAN 40 ok");
  assert(e.state.missions["c3_port"].status === "completed", "c3_port completed");
  assert(e.state.missions["c3_nat"].status === "available", "c3_nat unlocked");
}

console.log("\n[14] CHAPTER 3 NAT c3_nat");
{
  const e = completeChapter2Ready();
  completeC3Lab(e);
  completeC3Port(e);
  e.startMission("c3_nat");
  assert(e.state.activeMissionId === "c3_nat", "c3_nat started");
  assert(
    e.state.mails.some((m) => m.subjectKey === "missions.c3_nat.mailTicketSubject"),
    "IT-3120 mail is in the inbox"
  );
  assert(e.state.pendingDecision === null, "call waits until mail is read");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c3_nat.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  const listed = run(e, "WS-001", "sudo iptables -L").join("\n");
  assert(listed.includes("FW-NAT"), "FW-NAT listed");
  const open = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(noLoss(open), "published host is reachable");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo iptables -D FW-NAT");
  const closed = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(allLoss(closed), "payroll host unpublished");
  run(e, "WS-001", "ping 10.0.0.10");
  e.sendChat("itsupport", "NAT retirÃ©");
  assert(e.state.missions["c3_nat"].status === "completed", "c3_nat completed");
  assert(e.state.missions["c3_mission"].status === "available", "c3_mission unlocked after NAT");
}

console.log("\n[15] CHAPTER 3 MISSION c3_mission");
{
  const e = completeChapter2Ready();
  completeC3ThroughNat(e);
  e.startMission("c3_mission");
  assert(e.state.activeMissionId === "c3_mission", "c3_mission started");
  assert(
    e.state.mails.some((m) => m.subjectKey === "missions.c3_mission.mailTicketSubject"),
    "IT-3101 mail is in the inbox"
  );
  assert(e.state.activeWindow === "mail", "mail app opens so the ticket is visible");
  assert(e.state.pendingDecision === null, "phone call waits until the mail is read");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c3_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  assert(e.state.pendingDecision?.id === "c3m_call", "Lena calls after the ticket is read");
  e.answerDecision("A");
  run(e, "WS-001", "sudo iptables -L");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo iptables -D FW-VENDOR");
  const closed = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(allLoss(closed), "Finance closed after vendor hole removed");
  run(e, "WS-001", "ping 10.0.0.10");
  e.sendChat("itsupport", "trou FW-VENDOR fermÃ©, DNS OK");
  assert(e.state.missions["c3_mission"].status === "completed", `c3_mission completed (status=${e.state.missions["c3_mission"].status})`);
  assert(e.state.missions["c3_sim"].status === "available", "c3_sim unlocked");
}

console.log("\n[16] CHAPTER 3 ERROR — open any to Finance");
{
  const e = completeChapter2Ready();
  completeC3ThroughNat(e);
  e.startMission("c3_mission");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c3_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo iptables -L");
  assert(e.state.pendingDecision?.id === "c3m_marc", "Marc decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["c3_mission"].errorKeys.includes("opened_any"), "error recorded");
  assert(e.state.world.tickets.some((t) => t.id === "IT-3102"), "IT-3102 opened");
  assert(e.state.world.fwRules.some((r) => r.id === "FW-ANY"), "FW-ANY was added");
  run(e, "WS-001", "sudo iptables -D FW-VENDOR");
  run(e, "WS-001", "sudo iptables -D FW-ANY");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
  e.sendChat("itsupport", "corrigÃ© malgrÃ© tout");
  assert(e.state.missions["c3_mission"].status === "completed", "mission still completable");
  assert(e.state.missions["c3_mission"].score < 100, "score penalized");
}

for (const variant of ["any", "src", "wide"] as const) {
  console.log(`\n[17] SIM c3_sim variant=${variant}`);
  const e = completeChapter2Ready();
  completeC3ThroughNat(e);
  e.startMission("c3_mission");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c3_mission.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo iptables -L");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo iptables -D FW-VENDOR");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
  e.sendChat("itsupport", "FORWARD ok");

  e.startMission("c3_sim", variant);
  assert(e.state.missions["c3_sim"].variant === variant, `variant is ${variant}`);
  assert(
    e.state.mails.some((m) => m.subjectKey === "missions.c3_sim.mailSubject"),
    `[${variant}] exam mail is in the inbox`
  );
  assert(e.state.activeWindow === "mail", `[${variant}] mail workspace opened`);
  assert(e.state.pendingDecision === null, `[${variant}] call waits for mail-read`);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c3_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  const listed = run(e, "WS-001", "sudo iptables -L").join("\n");
  assert(listed.includes("FW-HOLE"), `[${variant}] FW-HOLE listed`);
  const probe = variant === "src" ? "PC-NOUR" : "WS-001";
  const before = run(e, probe, "ping 192.168.20.45").join("\n");
  assert(noLoss(before), `[${variant}] hole visible from ${probe}`);
  run(e, "WS-001", "sudo iptables -D FW-HOLE");
  const after = run(e, probe, "ping 192.168.20.45").join("\n");
  assert(allLoss(after), `[${variant}] Finance closed`);
  const dns = run(e, "WS-001", "ping 10.0.0.10").join("\n");
  assert(noLoss(dns), `[${variant}] DNS still up`);
  e.sendChat("itsupport", "rapport: trou FORWARD fermÃ©");
  const s = e.state.missions["c3_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Network Sentinel"),
    `[${variant}] Network Sentinel certificate`
  );
  assert(e.state.badges.includes("firewall_architect"), `[${variant}] badge firewall_architect`);
  assert(e.state.debrief !== null, `[${variant}] debrief available`);
  assert(e.state.chapter >= 4, `[${variant}] chapter advanced`);
}

console.log("\n[18] OLD SAVE — missing c3_mission runtime still starts and gets mail");
{
  const e = completeChapter2Ready();
  completeC3ThroughNat(e);
  delete e.state.missions["c3_mission"];
  delete e.state.missions["c3_sim"];
  e.startMission("c3_mission");
  assert(e.state.activeMissionId === "c3_mission", "hydrated runtime starts");
  assert(
    e.state.mails.some((m) => m.subjectKey === "missions.c3_mission.mailTicketSubject"),
    "ticket mail created on hydrated start"
  );
  assert(e.state.activeWindow === "mail", "mail workspace opened");
}

console.log("\n[19] CHAPTER 4 LAB c4_lab");
{
  const e = completeChapter3Ready();
  assert(e.state.missions["c4_lab"].status === "available", "c4_lab unlocked after chapter 3");
  assert(e.state.world.hosts["PC-WIN"]?.os.includes("Windows"), "PC-WIN exists on hydrated world");
  completeC4Lab(e);
  assert(e.state.missions["c4_lab"].status === "completed", "c4_lab completed");
  assert(e.state.world.hosts["PC-WIN"]?.dns[0] === "10.0.0.10", "Windows DNS set via netsh");
  assert(e.state.missions["c4_wifi"].status === "available", "c4_wifi unlocked");
}

console.log("\n[20] CHAPTER 4 WIFI c4_wifi");
{
  const e = completeChapter3Ready();
  completeC4Lab(e);
  e.startMission("c4_wifi");
  assert(e.state.activeMissionId === "c4_wifi", "c4_wifi started");
  assert(e.state.world.hosts["AP-01"]?.wifiAp?.ssid === "HORIZON-GUEST", "AP starts on guest SSID");
  assert(e.state.pendingDecision === null, "call waits until mail is read");
  const isolated = run(e, "PC-AMINA", "ping intranet.horizon").join("\n");
  assert(allLoss(isolated) || isolated.toLowerCase().includes("host") || isolated.includes("find host"), "guest Wi-Fi cannot resolve intranet");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c4_wifi.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  const info = run(e, "AP-01", "info").join("\n");
  assert(info.includes("HORIZON-GUEST"), "AP info shows guest SSID");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "AP-01", "set-ssid HORIZON-CORP");
  run(e, "AP-01", "set-vlan 10");
  assert(e.state.world.hosts["AP-01"]?.wifiAp?.ssid === "HORIZON-CORP", "SSID restored");
  assert(e.state.world.hosts["AP-01"]?.wifiAp?.vlan === 10, "VLAN 10 restored");
  run(e, "PC-AMINA", "netsh wlan connect name=HORIZON-CORP");
  const ok = run(e, "PC-AMINA", "ping intranet.horizon").join("\n");
  assert(noLoss(ok), "intranet reachable after corp Wi-Fi");
  e.sendChat("itsupport", "Wi-Fi métier ok");
  assert(e.state.missions["c4_wifi"].status === "completed", "c4_wifi completed");
  assert(e.state.missions["c4_desk"].status === "available", "c4_desk unlocked");
}

console.log("\n[21] CHAPTER 4 DESK c4_desk");
{
  const e = completeChapter3Ready();
  completeC4Lab(e);
  completeC4Wifi(e);
  e.startMission("c4_desk");
  assert(e.state.world.hosts["PC-AMINA"]?.accounts?.amina?.locked === true, "account starts locked");
  assert(e.state.world.hosts["PC-AMINA"]?.services.spooler === "inactive", "spooler stopped");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c4_desk.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  const listed = run(e, "PC-AMINA", "net user amina").join("\n");
  assert(listed.includes("Lockout") || listed.includes("Account active"), "net user shows account");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "PC-AMINA", "net user amina /active:yes");
  assert(e.state.world.hosts["PC-AMINA"]?.accounts?.amina?.active === true, "account unlocked");
  run(e, "PC-AMINA", "net start spooler");
  assert(e.state.world.hosts["PC-AMINA"]?.services.spooler === "active", "spooler running");
  const prn = run(e, "PC-AMINA", "ping 192.168.10.88").join("\n");
  assert(noLoss(prn), "printer reachable");
  e.sendChat("itsupport", "session et imprimante ok");
  assert(e.state.missions["c4_desk"].status === "completed", "c4_desk completed");
  assert(e.state.missions["c4_sim"].status === "available", "c4_sim unlocked");
}

console.log("\n[21b] CHAPTER 4 ERROR — password in chat");
{
  const e = completeChapter3Ready();
  completeC4Lab(e);
  completeC4Wifi(e);
  e.startMission("c4_desk");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c4_desk.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "PC-AMINA", "net user amina");
  assert(e.state.pendingDecision?.id === "c4d_pwd", "password decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["c4_desk"].errorKeys.includes("password_on_chat"), "error recorded");
  run(e, "PC-AMINA", "net user amina /active:yes");
  run(e, "PC-AMINA", "net start spooler");
  run(e, "PC-AMINA", "ping 192.168.10.88");
  e.sendChat("itsupport", "corrigé malgré tout");
  assert(e.state.missions["c4_desk"].status === "completed", "still completable");
  assert(e.state.missions["c4_desk"].score < 100, "score penalized");
}

for (const variant of ["link", "ip", "wifi"] as const) {
  console.log(`\n[22] SIM c4_sim variant=${variant}`);
  const e = completeChapter3Ready();
  completeC4Lab(e);
  completeC4Wifi(e);
  completeC4Desk(e);
  e.startMission("c4_sim", variant);
  assert(e.state.missions["c4_sim"].variant === variant, `variant is ${variant}`);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c4_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  run(e, "PC-WIN", "ipconfig /all");
  if (variant === "link") {
    run(e, "PC-WIN", 'netsh interface set interface name=Ethernet admin=ENABLED');
  } else if (variant === "ip") {
    run(e, "PC-WIN", "netsh interface ipv4 set address name=Ethernet static 192.168.10.55 255.255.255.0 192.168.10.1");
  } else {
    run(e, "PC-WIN", "netsh wlan connect name=HORIZON-CORP");
  }
  const verify = run(e, "PC-WIN", "ping intranet.horizon").join("\n");
  assert(noLoss(verify), `[${variant}] intranet verified`);
  e.sendChat("itsupport", "rapport: PC-WIN ok");
  const s = e.state.missions["c4_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Service Desk Associate"),
    `[${variant}] Service Desk Associate certificate`
  );
  assert(e.state.chapter >= 5, `[${variant}] chapter advanced`);
}

console.log("\n[23] OLD SAVE — missing c4_lab runtime still starts after chapter 3");
{
  const e = completeChapter3Ready();
  delete e.state.missions["c4_lab"];
  delete e.state.missions["c4_wifi"];
  delete e.state.missions["c4_desk"];
  delete e.state.missions["c4_sim"];
  e.startMission("c4_lab");
  assert(e.state.activeMissionId === "c4_lab", "c4_lab starts from a save that lacked chapter 4 runtimes");
  assert(e.state.world.hosts["PC-WIN"]?.os.includes("Windows"), "PC-WIN hydrated onto old save");
}

console.log("\n[24] E2 — mission SLA clock");
{
  const e = newEngine();
  const startRep = e.state.reputation;
  e.startMission("c1_lab");
  const rt = e.state.missions["c1_lab"];
  assert(typeof rt.deadlineMin === "number", "deadline set on start");
  assert(rt.deadlineMin === e.state.timeMin + 12, "SLA matches estimateMin");
  assert(e.remainingMin() === 12, "12 minutes remaining");
  const deadline = rt.deadlineMin!;
  while (e.state.timeMin < deadline) e.tick();
  assert(e.state.missions["c1_lab"].overtime === true, "overtime flagged at SLA");
  assert(e.state.missions["c1_lab"].errorKeys.includes("overtime"), "overtime error key");
  assert(e.state.reputation < startRep, "reputation hit");
  assert(e.state.dossier.some((d) => d.kind === "overtime"), "career file records overtime");
  e.tick();
  e.tick();
  assert(e.state.dossier.filter((d) => d.kind === "overtime").length === 1, "overtime recorded once");
}

console.log("\n[25] E2 — career file records a decision");
{
  const e = newEngine();
  e.startMission("c1_lab");
  run(e, "WS-001", "help");
  run(e, "WS-001", "whoami");
  run(e, "WS-001", "hostname");
  run(e, "WS-001", "ip addr");
  run(e, "WS-001", "ping 192.168.10.1");
  run(e, "WS-001", "ping 10.0.0.10");
  run(e, "WS-001", "ping intranet.horizon");
  run(e, "WS-001", "cat /etc/resolv.conf");
  e.writeFile("WS-001", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "WS-001", "ping intranet.horizon");
  e.startMission("c1_mission");
  e.answerDecision("B");
  assert(
    e.state.dossier.some((d) => d.kind === "decision" && d.choiceId === "B" && d.missionId === "c1_mission"),
    "call decision is in the career file"
  );
}

console.log("\n[26] E2 — old save without dossier hydrates");
{
  const e = newEngine();
  delete (e.state as { dossier?: unknown }).dossier;
  e.startMission("c1_lab");
  assert(Array.isArray(e.state.dossier), "dossier array after hydrate");
}

console.log("\n[27] CHAPTER 5 LAB c5_lab");
{
  const e = completeChapter4Ready();
  assert(e.state.missions["c5_lab"].status === "available", "c5_lab unlocked after chapter 4");
  assert(e.state.world.hosts["SRV-DC"]?.os.includes("Samba"), "SRV-DC hydrated onto world");
  e.startMission("c5_lab");
  assert(e.state.world.hosts["SRV-WEB"]?.services.nginx === "failed", "nginx starts failed");
  const down = run(e, "WS-001", "curl intranet.horizon").join("\n");
  assert(down.includes("refused") || down.toLowerCase().includes("fail"), "curl fails while nginx is down");
  completeC5Lab(e);
  assert(e.state.missions["c5_lab"].status === "completed", "c5_lab completed");
  const up = run(e, "WS-001", "curl intranet.horizon").join("\n");
  assert(up.includes("200"), "intranet 200 after nginx start");
  assert(e.state.world.hosts["COMP-01"]?.services.smbd === "active", "smbd left running");
  assert(e.state.missions["c5_web"].status === "available", "c5_web unlocked");
}

console.log("\n[28] CHAPTER 5 WEB c5_web");
{
  const e = completeChapter4Ready();
  completeC5Lab(e);
  e.startMission("c5_web");
  assert(e.state.activeMissionId === "c5_web", "c5_web started");
  assert(!e.state.world.dns?.["rh.horizon.local"], "RH name not in DNS yet");
  assert(e.state.world.vhosts?.["rh.horizon.local"]?.enabled === false, "vhost disabled");
  const nx = run(e, "WS-001", "dig rh.horizon.local").join("\n");
  assert(nx.includes("NXDOMAIN"), "NXDOMAIN before nsupdate");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c5_web.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "WS-001", "dig rh.horizon.local");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "DNS-01", "sudo nsupdate add rh.horizon.local A 10.0.0.20");
  assert(e.state.world.dns?.["rh.horizon.local"] === "10.0.0.20", "A record added");
  const listed = run(e, "SRV-WEB", "ls /etc/nginx/sites-enabled").join("\n");
  assert(!listed.includes("rh.horizon.local") || listed.includes("(empty)") || !listed.split("\n").includes("rh.horizon.local"), "site not enabled yet");
  run(e, "SRV-WEB", "sudo ln -s /etc/nginx/sites-available/rh.horizon.local /etc/nginx/sites-enabled/rh.horizon.local");
  assert(e.state.world.vhosts?.["rh.horizon.local"]?.enabled === true, "vhost enabled");
  const page = run(e, "WS-001", "curl rh.horizon.local").join("\n");
  assert(page.includes("200") && page.toLowerCase().includes("rh"), "RH site 200");
  e.sendChat("itsupport", "portail RH en ligne");
  assert(e.state.missions["c5_web"].status === "completed", "c5_web completed");
  assert(e.state.missions["c5_ad"].status === "available", "c5_ad unlocked");
}

console.log("\n[28b] CHAPTER 5 ERROR — skip DNS");
{
  const e = completeChapter4Ready();
  completeC5Lab(e);
  e.startMission("c5_web");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c5_web.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "WS-001", "dig rh.horizon.local");
  assert(e.state.pendingDecision?.id === "c5w_marc", "skip-DNS decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["c5_web"].errorKeys.includes("skip_dns"), "error recorded");
  run(e, "DNS-01", "sudo nsupdate add rh.horizon.local A 10.0.0.20");
  run(e, "SRV-WEB", "sudo ln -s /etc/nginx/sites-available/rh.horizon.local /etc/nginx/sites-enabled/rh.horizon.local");
  run(e, "WS-001", "curl rh.horizon.local");
  e.sendChat("itsupport", "quand meme en ligne");
  assert(e.state.missions["c5_web"].status === "completed", "still completable");
  assert(e.state.missions["c5_web"].score < 100, "score penalized");
}

console.log("\n[29] CHAPTER 5 AD c5_ad");
{
  const e = completeChapter4Ready();
  completeC5Lab(e);
  completeC5Web(e);
  e.startMission("c5_ad");
  assert(!e.state.world.directory?.jmorel, "jmorel absent at start");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c5_ad.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  const listed = run(e, "SRV-DC", "samba-tool user list").join("\n");
  assert(!listed.includes("jmorel"), "user list has no jmorel");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "SRV-DC", "samba-tool user create jmorel Horizon!2024");
  assert(e.state.world.directory?.jmorel?.enabled === true, "jmorel created");
  const show = run(e, "SRV-DC", "samba-tool user show jmorel").join("\n");
  assert(show.includes("jmorel") && show.includes("Domain Users"), "show lists Domain Users");
  e.sendChat("itsupport", "compte jmorel pret");
  assert(e.state.missions["c5_ad"].status === "completed", "c5_ad completed");
  assert(e.state.missions["c5_sim"].status === "available", "c5_sim unlocked");
}

console.log("\n[29b] CHAPTER 5 ERROR — Domain Admins");
{
  const e = completeChapter4Ready();
  completeC5Lab(e);
  completeC5Web(e);
  e.startMission("c5_ad");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c5_ad.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "SRV-DC", "samba-tool user list");
  assert(e.state.pendingDecision?.id === "c5a_admin", "Domain Admins decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["c5_ad"].errorKeys.includes("domain_admins"), "error recorded");
  run(e, "SRV-DC", "samba-tool user create jmorel Horizon!2024");
  run(e, "SRV-DC", "samba-tool user show jmorel");
  e.sendChat("itsupport", "compte cree malgre tout");
  assert(e.state.missions["c5_ad"].status === "completed", "still completable");
  assert(e.state.missions["c5_ad"].score < 100, "score penalized");
}

for (const variant of ["nginx", "vhost", "ad"] as const) {
  console.log(`\n[30] SIM c5_sim variant=${variant}`);
  const e = completeChapter4Ready();
  completeC5Lab(e);
  completeC5Web(e);
  completeC5Ad(e);
  e.startMission("c5_sim", variant);
  assert(e.state.missions["c5_sim"].variant === variant, `variant is ${variant}`);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c5_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  if (variant === "nginx") {
    assert(e.state.world.hosts["SRV-WEB"]?.services.nginx === "failed", "nginx down");
    run(e, "SRV-WEB", "sudo systemctl start nginx");
    const verify = run(e, "WS-001", "curl intranet.horizon").join("\n");
    assert(verify.includes("200"), `[${variant}] intranet verified`);
  } else if (variant === "vhost") {
    assert(e.state.world.vhosts?.["rh.horizon.local"]?.enabled === false, "vhost disabled");
    run(e, "SRV-WEB", "sudo ln -s /etc/nginx/sites-available/rh.horizon.local /etc/nginx/sites-enabled/rh.horizon.local");
    const verify = run(e, "WS-001", "curl rh.horizon.local").join("\n");
    assert(verify.includes("200"), `[${variant}] RH site verified`);
  } else {
    assert(e.state.world.directory?.jmorel?.locked === true, "jmorel locked");
    run(e, "SRV-DC", "samba-tool user unlock jmorel");
    const show = run(e, "SRV-DC", "samba-tool user show jmorel").join("\n");
    assert(show.includes("NORMAL_ACCOUNT"), `[${variant}] account unlocked`);
  }
  e.sendChat("itsupport", "rapport: incident systemes clos");
  const s = e.state.missions["c5_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Systems Technician"),
    `[${variant}] Systems Technician certificate`
  );
  assert(e.state.chapter >= 6, `[${variant}] chapter advanced`);
}

console.log("\n[31] OLD SAVE — missing c5_lab runtime still starts after chapter 4");
{
  const e = completeChapter4Ready();
  delete e.state.missions["c5_lab"];
  delete e.state.missions["c5_web"];
  delete e.state.missions["c5_ad"];
  delete e.state.missions["c5_sim"];
  e.startMission("c5_lab");
  assert(e.state.activeMissionId === "c5_lab", "c5_lab starts from a save that lacked chapter 5 runtimes");
  assert(e.state.world.hosts["SRV-DC"]?.os.includes("Samba"), "SRV-DC hydrated onto old save");
  assert(Array.isArray(Object.keys(e.state.world.directory ?? {})), "directory hydrated");
}

console.log("\n[32] CHAPTER 6 LAB c6_lab");
{
  const e = completeChapter5Ready();
  assert(e.state.missions["c6_lab"].status === "available", "c6_lab unlocked after chapter 5");
  e.startMission("c6_lab");
  assert(e.state.world.fwRules.some((r) => r.id === "PF-HOLE"), "PF-HOLE present at lab start");
  const listed = run(e, "FW-PFS", "pfctl -sr").join("\n");
  assert(listed.includes("PF-HOLE"), "pfctl -sr shows PF-HOLE");
  const leak = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(noLoss(leak), "Finance reachable while hole is open");
  run(e, "FW-PFS", "easyrule delete wan PF-HOLE");
  assert(!e.state.world.fwRules.some((r) => r.id === "PF-HOLE"), "PF-HOLE deleted");
  const closed = run(e, "WS-001", "ping 192.168.20.45").join("\n");
  assert(allLoss(closed) || closed.toLowerCase().includes("filter") || closed.toLowerCase().includes("timeout"), "Finance blocked after delete");
  const dns = run(e, "WS-001", "ping 10.0.0.10").join("\n");
  assert(noLoss(dns), "DNS still reachable");
  assert(e.state.missions["c6_lab"].status === "completed", "c6_lab completed");
  assert(e.state.missions["c6_mt"].status === "available", "c6_mt unlocked");
}

console.log("\n[33] CHAPTER 6 MISSION c6_mt");
{
  const e = completeChapter5Ready();
  completeC6Lab(e);
  e.startMission("c6_mt");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c6_mt.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  const before = run(e, "PC-LEA", "ping 10.0.0.20").join("\n");
  assert(
    before.toLowerCase().includes("no-route") || allLoss(before) || before.toLowerCase().includes("unreachable") || before.toLowerCase().includes("échec") || before.toLowerCase().includes("echec"),
    "branch intranet down before route/NAT"
  );
  run(e, "RTR-BR", "/ip address print");
  assert(e.state.pendingDecision?.id === "c6m_nat", "skip NAT decision shown");
  e.answerDecision("B");
  run(e, "RTR-BR", "/ip route print");
  run(e, "RTR-BR", "/ip route add dst-address=0.0.0.0/0 gateway=172.16.0.1");
  run(e, "RTR-BR", "/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade");
  const after = run(e, "PC-LEA", "ping 10.0.0.20").join("\n");
  assert(noLoss(after), "intranet reachable from PC-LEA after route+NAT");
  e.sendChat("itsupport", "filiale retablie ping 10.0.0.20");
  assert(e.state.missions["c6_mt"].status === "completed", "c6_mt completed");
  assert(e.state.badges.includes("vendor_net"), "badge vendor_net");
  assert(e.state.missions["c6_unifi"].status === "available", "c6_unifi unlocked");
}

console.log("\n[33b] CHAPTER 6 ERROR — skip NAT");
{
  const e = completeChapter5Ready();
  completeC6Lab(e);
  e.startMission("c6_mt");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c6_mt.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "RTR-BR", "/ip address print");
  assert(e.state.pendingDecision?.id === "c6m_nat", "NAT decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["c6_mt"].errorKeys.includes("skip_nat"), "skip_nat recorded");
  run(e, "RTR-BR", "/ip route add dst-address=0.0.0.0/0 gateway=172.16.0.1");
  run(e, "RTR-BR", "/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade");
  run(e, "PC-LEA", "ping 10.0.0.20");
  e.sendChat("itsupport", "filiale ok malgre tout");
  assert(e.state.missions["c6_mt"].status === "completed", "still completable");
  assert(e.state.missions["c6_mt"].score < 100, "score penalized");
}

console.log("\n[34] CHAPTER 6 MISSION c6_unifi");
{
  const e = completeChapter5Ready();
  completeC6Lab(e);
  completeC6Mt(e);
  e.startMission("c6_unifi");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c6_unifi.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  const leak = run(e, "PC-PAUL", "ping 192.168.10.24").join("\n");
  assert(noLoss(leak), "guest leaks to office before isolation");
  run(e, "GW-UDM", "info");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "GW-UDM", "show firewall");
  run(e, "GW-UDM", "set-guest-isolation on");
  assert(!e.state.world.fwRules.some((r) => r.id === "GUEST-LAN"), "GUEST-LAN removed");
  const isolated = run(e, "PC-PAUL", "ping 192.168.10.24").join("\n");
  assert(allLoss(isolated) || isolated.toLowerCase().includes("filter") || isolated.toLowerCase().includes("timeout"), "guest no longer reaches office");
  const dns = run(e, "WS-001", "ping 10.0.0.10").join("\n");
  assert(noLoss(dns), "office DNS intact");
  e.sendChat("itsupport", "isolation guest on");
  assert(e.state.missions["c6_unifi"].status === "completed", "c6_unifi completed");
  assert(e.state.missions["c6_sim"].status === "available", "c6_sim unlocked");
}

console.log("\n[34b] CHAPTER 6 ERROR — leave guest open");
{
  const e = completeChapter5Ready();
  completeC6Lab(e);
  completeC6Mt(e);
  e.startMission("c6_unifi");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.c6_unifi.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "GW-UDM", "info");
  assert(e.state.pendingDecision?.id === "c6u_marc", "leave guest open decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["c6_unifi"].errorKeys.includes("left_guest_open"), "left_guest_open recorded");
  run(e, "GW-UDM", "set-guest-isolation on");
  e.sendChat("itsupport", "isolation quand meme");
  assert(e.state.missions["c6_unifi"].status === "completed", "still completable");
  assert(e.state.missions["c6_unifi"].score < 100, "score penalized");
}

for (const variant of ["pf", "route", "guest"] as const) {
  console.log(`\n[35] SIM c6_sim variant=${variant}`);
  const e = completeChapter5Ready();
  completeC6Lab(e);
  completeC6Mt(e);
  completeC6Unifi(e);
  e.startMission("c6_sim", variant);
  assert(e.state.missions["c6_sim"].variant === variant, `variant is ${variant}`);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.c6_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  if (variant === "pf") {
    assert(e.state.world.fwRules.some((r) => r.id === "PF-HOLE"), "PF-HOLE injected");
    run(e, "FW-PFS", "easyrule delete wan PF-HOLE");
    const verify = run(e, "WS-001", "ping 192.168.20.45").join("\n");
    assert(allLoss(verify) || verify.toLowerCase().includes("filter") || verify.toLowerCase().includes("timeout"), `[${variant}] Finance closed`);
  } else if (variant === "route") {
    assert(!(e.state.world.hosts["RTR-BR"]?.routes ?? []).length, "branch routes empty");
    run(e, "RTR-BR", "/ip route add dst-address=0.0.0.0/0 gateway=172.16.0.1");
    run(e, "RTR-BR", "/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade");
    const verify = run(e, "PC-LEA", "ping 10.0.0.20").join("\n");
    assert(noLoss(verify), `[${variant}] branch intranet verified`);
  } else {
    assert(e.state.world.hosts["GW-UDM"]?.guestIsolation === false, "guest isolation off");
    run(e, "GW-UDM", "set-guest-isolation on");
    const verify = run(e, "PC-PAUL", "ping 192.168.10.24").join("\n");
    assert(allLoss(verify) || verify.toLowerCase().includes("filter") || verify.toLowerCase().includes("timeout"), `[${variant}] guest isolated`);
  }
  e.sendChat("itsupport", "rapport: incident reseau clos");
  const s = e.state.missions["c6_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Network Administrator"),
    `[${variant}] Network Administrator certificate`
  );
  assert(e.state.chapter >= 7, `[${variant}] chapter advanced`);
}

console.log("\n[36] OLD SAVE — missing c6 hosts still start after chapter 5");
{
  const e = completeChapter5Ready();
  delete e.state.missions["c6_lab"];
  delete e.state.missions["c6_mt"];
  delete e.state.missions["c6_unifi"];
  delete e.state.missions["c6_sim"];
  delete e.state.world.hosts["FW-PFS"];
  delete e.state.world.hosts["RTR-BR"];
  delete e.state.world.hosts["GW-UDM"];
  delete e.state.world.hosts["PC-LEA"];
  const hq = e.state.world.hosts["RTR-HQ"];
  if (hq?.ifaces.eth5) delete hq.ifaces.eth5;
  e.startMission("c6_lab");
  assert(e.state.activeMissionId === "c6_lab", "c6_lab starts from a save that lacked chapter 6 runtimes");
  assert(e.state.world.hosts["FW-PFS"]?.os.includes("pfSense"), "FW-PFS hydrated onto old save");
  assert(e.state.world.hosts["RTR-BR"]?.os.includes("RouterOS"), "RTR-BR hydrated");
  assert(e.state.world.hosts["GW-UDM"]?.os.includes("UniFi"), "GW-UDM hydrated");
  assert(e.state.world.hosts["PC-LEA"]?.ifaces.eth0.ip === "192.168.50.24", "PC-LEA hydrated");
  assert(e.state.world.hosts["SRV-WEB"]?.os.includes("Debian") || !!e.state.world.hosts["SRV-WEB"], "SRV-WEB still present");
  assert(e.state.world.hosts["RTR-HQ"]?.ifaces.eth5?.ip === "172.16.0.1", "RTR-HQ eth5 hydrated on old save");
}

console.log("\n[37] CHAPTER 7 LAB e5_lab");
{
  const e = completeChapter6Ready();
  assert(e.state.missions["e5_lab"].status === "available", "e5_lab unlocked after chapter 6");
  e.startMission("e5_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  assert(!e.state.world.hosts["LAB-FW"], "rack empty at lab start");
  e.dispatchAction("workshop-place", { kind: "pfsense" });
  e.dispatchAction("workshop-place", { kind: "switch" });
  e.dispatchAction("workshop-place", { kind: "server" });
  e.dispatchAction("workshop-place", { kind: "pc" });
  e.dispatchAction("workshop-place", { kind: "ap" });
  assert(!!e.state.world.hosts["LAB-FW"] && !!e.state.world.hosts["LAB-SW"], "devices placed");
  e.dispatchAction("workshop-cable", { a: "LAB-FW", b: "LAB-SW" });
  e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-WEB" });
  e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-PC" });
  e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-AP" });
  assert(e.state.missions["e5_lab"].status === "completed", "e5_lab completed");
  assert(e.state.badges.includes("rack_builder"), "badge rack_builder");
  assert(e.state.missions["e5_site"].status === "available", "e5_site unlocked");
}

console.log("\n[37b] CHAPTER 7 ERROR — skip switch");
{
  const e = completeChapter6Ready();
  e.startMission("e5_lab");
  assert(e.state.pendingDecision?.id === "e5_skip", "skip switch decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e5_lab"].errorKeys.includes("skip_switch"), "skip_switch recorded");
  buildLabRack(e);
  assert(e.state.missions["e5_lab"].status === "completed", "still completable");
  assert(e.state.missions["e5_lab"].score < 100, "score penalized");
}

console.log("\n[38] CHAPTER 7 MISSION e5_site");
{
  const e = completeChapter6Ready();
  completeE5Lab(e);
  e.startMission("e5_site");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.e5_site.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "LAB-FW", "ifconfig em1 10.20.0.1/24");
  assert(e.state.world.hosts["LAB-FW"]?.ifaces.em1?.ip === "10.20.0.1", "LAN address on pfSense");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "LAB-WEB", "ip addr add 10.20.0.20/24 dev eth0");
  run(e, "LAB-PC", "ip addr add 10.20.0.24/24 dev eth0");
  run(e, "LAB-WEB", "sudo nsupdate add lab.horizon.local A 10.20.0.20");
  run(e, "LAB-WEB", "sudo ln -s /etc/nginx/sites-available/lab.horizon.local /etc/nginx/sites-enabled/lab.horizon.local");
  const page = run(e, "LAB-PC", "curl lab.horizon.local").join("\n");
  assert(page.includes("200"), "lab site 200 from LAB-PC");
  e.sendChat("itsupport", "lab.horizon.local 200");
  assert(e.state.missions["e5_site"].status === "completed", "e5_site completed");
  assert(e.state.missions["e5_sim"].status === "available", "e5_sim unlocked");
}

console.log("\n[38b] CHAPTER 7 ERROR — skip DNS");
{
  const e = completeChapter6Ready();
  completeE5Lab(e);
  e.startMission("e5_site");
  const ticket = e.state.mails.find((m) => m.subjectKey === "missions.e5_site.mailTicketSubject")!;
  e.readMail(ticket.id);
  e.answerDecision("A");
  run(e, "LAB-FW", "ifconfig em1 10.20.0.1/24");
  assert(e.state.pendingDecision?.id === "e5s_dns", "skip DNS decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e5_site"].errorKeys.includes("skip_dns"), "skip_dns recorded");
  run(e, "LAB-WEB", "ip addr add 10.20.0.20/24 dev eth0");
  run(e, "LAB-PC", "ip addr add 10.20.0.24/24 dev eth0");
  run(e, "LAB-WEB", "sudo nsupdate add lab.horizon.local A 10.20.0.20");
  run(e, "LAB-WEB", "sudo ln -s /etc/nginx/sites-available/lab.horizon.local /etc/nginx/sites-enabled/lab.horizon.local");
  run(e, "LAB-PC", "curl lab.horizon.local");
  e.sendChat("itsupport", "site ok malgre tout");
  assert(e.state.missions["e5_site"].status === "completed", "still completable");
  assert(e.state.missions["e5_site"].score < 100, "score penalized");
}

for (const variant of ["cable", "addr", "nginx"] as const) {
  console.log(`\n[39] SIM e5_sim variant=${variant}`);
  const e = completeChapter6Ready();
  completeE5Lab(e);
  completeE5Site(e);
  e.startMission("e5_sim", variant);
  assert(e.state.missions["e5_sim"].variant === variant, `variant is ${variant}`);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.e5_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  if (variant === "cable") {
    e.dispatchAction("workshop-cable", { a: "LAB-SW", b: "LAB-WEB" });
  } else if (variant === "addr") {
    run(e, "LAB-WEB", "ip addr add 10.20.0.20/24 dev eth0");
  } else {
    run(e, "LAB-WEB", "sudo systemctl start nginx");
  }
  const verify = run(e, "LAB-PC", "curl lab.horizon.local").join("\n");
  assert(verify.includes("200"), `[${variant}] lab site verified`);
  e.sendChat("itsupport", "rapport: atelier clos");
  const s = e.state.missions["e5_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Junior Architect"),
    `[${variant}] Junior Architect certificate`
  );
  assert(e.state.chapter >= 8, `[${variant}] chapter advanced`);
}

console.log("\n[40] OLD SAVE — missing e5_lab runtime still starts after chapter 6");
{
  const e = completeChapter6Ready();
  delete e.state.missions["e5_lab"];
  delete e.state.missions["e5_site"];
  delete e.state.missions["e5_sim"];
  e.startMission("e5_lab");
  assert(e.state.activeMissionId === "e5_lab", "e5_lab starts from a save that lacked workshop runtimes");
  assert(Array.isArray(e.state.world.workshop?.nodes), "workshop hydrated");
}

console.log("\n[40b] WORKSHOP SANDBOX GNS");
{
  const e = completeChapter6Ready();
  e.dispatchAction("workshop-place", { kind: "mikrotik" });
  assert(!!e.state.world.hosts["LAB-MT"], "first mikrotik is LAB-MT");
  assert(e.state.world.hosts["LAB-MT"]?.os.includes("RouterOS"), "RouterOS on lab mikrotik");
  e.dispatchAction("workshop-place", { kind: "pc" });
  assert(!!e.state.world.hosts["LAB-PC"], "first pc is LAB-PC");
  e.dispatchAction("workshop-place", { kind: "pc" });
  assert(!!e.state.world.hosts["LAB-PC-2"], "second pc is LAB-PC-2");
  e.dispatchAction("workshop-place", { kind: "camera" });
  e.dispatchAction("workshop-place", { kind: "unifi_gw" });
  assert(!!e.state.world.hosts["LAB-CAM"], "camera placed");
  assert(e.state.world.hosts["LAB-UDM"]?.os.includes("Dream Machine"), "UDM placed");
  e.dispatchAction("workshop-cable", { a: "LAB-MT", b: "LAB-PC" });
  assert(
    (e.state.world.workshop?.links ?? []).some(([a, b]) => a === "LAB-MT" && b === "LAB-PC"),
    "sandbox cable stored"
  );
  e.dispatchAction("workshop-move", { id: "LAB-MT", x: 200, y: 120 });
  const moved = e.state.world.workshop?.nodes.find((n) => n.id === "LAB-MT");
  assert(moved?.x === 200 && moved?.y === 120, "device moved");
  e.dispatchAction("workshop-uncable", { a: "LAB-MT", b: "LAB-PC" });
  assert(
    !(e.state.world.workshop?.links ?? []).some(([a, b]) => a === "LAB-MT" || b === "LAB-MT"),
    "sandbox uncable"
  );
  e.dispatchAction("workshop-remove", { id: "LAB-PC-2" });
  assert(!e.state.world.hosts["LAB-PC-2"], "extra pc removed");
  assert(!!e.state.world.hosts["LAB-PC"], "canonical pc kept");
  e.dispatchAction("workshop-clear");
  assert(!e.state.world.hosts["LAB-MT"] && (e.state.world.workshop?.nodes.length ?? 0) === 0, "sandbox cleared");
  e.startMission("e5_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  assert(!e.state.world.hosts["LAB-FW"], "e5_lab still empties the rack");
  e.dispatchAction("workshop-place", { kind: "pfsense" });
  assert(e.state.world.hosts["LAB-FW"]?.id === "LAB-FW", "first pfsense remains LAB-FW");
  e.dispatchAction("workshop-clear");
  assert(!!e.state.world.hosts["LAB-FW"], "clear blocked during e5_lab");
}

console.log("\n[41] CHAPTER 8 LAB e6_lab");
{
  const e = completeChapter7Ready();
  assert(e.state.missions["e6_lab"].status === "available", "e6_lab unlocked after chapter 7");
  e.startMission("e6_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  assert((e.state.world.socAlerts ?? []).length === 10, "10 SIEM alerts queued");
  assert(e.state.world.hosts["SRV-WEB"]?.logs.some((l) => l.includes("Failed password")), "brute logs on SRV-WEB");
  triageNoise(e);
  const logs = run(e, "SRV-WEB", "journalctl -u sshd").join("\n");
  assert(logs.includes("Failed password"), "sshd failures visible in journalctl");
  e.dispatchAction("soc-escalate", { id: "SOC-8009" });
  e.sendChat("soc", "SSH-BRUTE confirme sur SRV-WEB, bruit ferme.");
  assert(e.state.missions["e6_lab"].status === "completed", "e6_lab completed");
  assert(e.state.badges.includes("soc_triage"), "badge soc_triage");
  assert(e.state.missions["e6_phish"].status === "available", "e6_phish unlocked");
}

console.log("\n[41b] CHAPTER 8 ERROR — dump queue to Soriya");
{
  const e = completeChapter7Ready();
  e.startMission("e6_lab");
  assert(e.state.pendingDecision?.id === "e6_dump", "dump-queue decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e6_lab"].errorKeys.includes("flood_soriya"), "flood_soriya recorded");
  triageNoise(e);
  run(e, "SRV-WEB", "journalctl -u sshd");
  e.dispatchAction("soc-escalate", { id: "SOC-8009" });
  e.sendChat("soc", "quand meme");
  assert(e.state.missions["e6_lab"].status === "completed", "still completable");
  assert(e.state.missions["e6_lab"].score < 100, "score penalized");
}

console.log("\n[42] CHAPTER 8 MISSION e6_phish");
{
  const e = completeChapter7Ready();
  completeE6Lab(e);
  e.startMission("e6_phish");
  const phish = e.state.mails.find((m) => m.subjectKey === "missions.e6_phish.mailSubject")!;
  e.readMail(phish.id);
  e.answerDecision("A");
  e.dispatchAction("mail-report-phish", { mailId: phish.id });
  e.dispatchAction("soc-escalate", { id: "SOC-8101" });
  e.sendChat("soc", "phishing horiz0n signale, pas de clic.");
  assert(e.state.missions["e6_phish"].status === "completed", "e6_phish completed");
  assert(e.state.missions["e6_sim"].status === "available", "e6_sim unlocked");
}

console.log("\n[42b] CHAPTER 8 ERROR — click phishing");
{
  const e = completeChapter7Ready();
  completeE6Lab(e);
  e.startMission("e6_phish");
  const phish = e.state.mails.find((m) => m.subjectKey === "missions.e6_phish.mailSubject")!;
  e.readMail(phish.id);
  assert(e.state.pendingDecision?.id === "e6p_click", "click decision shown");
  e.answerDecision("B");
  e.closeLearning();
  assert(e.state.missions["e6_phish"].errorKeys.includes("phish_click"), "phish_click recorded");
  e.dispatchAction("mail-report-phish", { mailId: phish.id });
  e.sendChat("soc", "signale apres clic");
  assert(e.state.missions["e6_phish"].status === "completed", "still completable");
  assert(e.state.missions["e6_phish"].score < 100, "score penalized");
}

for (const variant of ["noise", "brute", "phish"] as const) {
  console.log(`\n[43] SIM e6_sim variant=${variant}`);
  const e = completeChapter7Ready();
  completeE6Lab(e);
  completeE6Phish(e);
  e.startMission("e6_sim", variant);
  assert(e.state.missions["e6_sim"].variant === variant, `variant is ${variant}`);
  const examMail = e.state.mails.find((m) =>
    m.subjectKey === "missions.e6_sim.mailSubject" || m.subjectKey === "missions.e6_phish.mailSubject"
  )!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  if (variant === "noise") {
    triageNoise(e);
  } else if (variant === "brute") {
    run(e, "SRV-WEB", "journalctl -u sshd");
    e.dispatchAction("soc-escalate", { id: "SOC-8009" });
  } else {
    e.dispatchAction("mail-report-phish", { mailId: examMail.id });
    e.dispatchAction("soc-escalate", { id: "SOC-8101" });
  }
  e.sendChat("soc", "rapport: quart L1 clos");
  const s = e.state.missions["e6_sim"];
  assert(s.status === "completed", `[${variant}] sim completed (status=${s.status})`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "SOC Analyst L1"),
    `[${variant}] SOC Analyst L1 certificate`
  );
  assert(e.state.chapter >= 9, `[${variant}] chapter advanced`);
}

console.log("\n[44] OLD SAVE — missing e6_lab runtime still starts after chapter 7");
{
  const e = completeChapter7Ready();
  delete e.state.missions["e6_lab"];
  delete e.state.missions["e6_phish"];
  delete e.state.missions["e6_sim"];
  e.startMission("e6_lab");
  assert(e.state.activeMissionId === "e6_lab", "e6_lab starts from a save that lacked SOC runtimes");
  assert(Array.isArray(e.state.world.socAlerts), "socAlerts hydrated");
}

console.log("\n[45] CHAPTER 9 LAB e7_lab");
{
  const e = completeChapter8Ready();
  assert(e.state.missions["e7_lab"].status === "available", "e7_lab unlocked after chapter 8");
  e.startMission("e7_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  const hashOut = run(e, "WS-001", `sha256sum ${SAMPLE_FILE}`).join("\n");
  assert(hashOut.includes(SAMPLE_HASH), "sandbox hash printed");
  const strOut = run(e, "WS-001", `strings ${SAMPLE_FILE}`).join("\n");
  assert(strOut.includes("beacon"), "sandbox strings are a text extract");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  assert(!!e.state.world.hosts["PC-PAUL"]?.isolated, "PC-PAUL isolated");
  const paulPing = run(e, "PC-PAUL", "ping 10.0.0.10").join("\n");
  assert(allLoss(paulPing) || paulPing.toLowerCase().includes("filter") || paulPing.includes("100%"), "isolated host cannot ping DNS");
  e.sendChat("soc", "isole hash lu");
  assert(e.state.missions["e7_lab"].status === "completed", "e7_lab completed");
  assert(e.state.badges.includes("sandbox_analyst"), "badge sandbox_analyst");
}

console.log("\n[45b] CHAPTER 9 ERROR — run sample");
{
  const e = completeChapter8Ready();
  e.startMission("e7_lab");
  assert(e.state.pendingDecision?.id === "e7_run", "run-sample decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e7_lab"].errorKeys.includes("run_sample"), "run_sample recorded");
  run(e, "WS-001", `sha256sum ${SAMPLE_FILE}`);
  run(e, "WS-001", `strings ${SAMPLE_FILE}`);
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  e.sendChat("soc", "quand meme");
  assert(e.state.missions["e7_lab"].status === "completed", "still completable");
  assert(e.state.missions["e7_lab"].score < 100, "score penalized");
}

console.log("\n[46] CHAPTER 9 MISSION e7_ioc");
{
  const e = completeChapter8Ready();
  completeE7Lab(e);
  e.startMission("e7_ioc");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e7_ioc.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "PC-PAUL", "grep beacon /var/log/syslog");
  run(e, "WS-001", `ioc add ${SAMPLE_HASH}`);
  assert((e.state.world.iocs ?? []).some((h) => h.includes("a4f3")), "IOC on watchlist");
  e.sendChat("soc", "IOC pose");
  assert(e.state.missions["e7_ioc"].status === "completed", "e7_ioc completed");
}

for (const variant of ["hash", "isolate", "ioc"] as const) {
  console.log(`\n[47] SIM e7_sim variant=${variant}`);
  const e = completeChapter8Ready();
  completeE7Lab(e);
  completeE7Ioc(e);
  e.startMission("e7_sim", variant);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.e7_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  if (variant === "hash") run(e, "WS-001", `sha256sum ${SAMPLE_FILE}`);
  else if (variant === "isolate") run(e, "WS-001", "sudo edr isolate PC-PAUL");
  else run(e, "WS-001", `ioc add ${SAMPLE_HASH}`);
  e.sendChat("soc", "rapport L2");
  const s = e.state.missions["e7_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Security Analyst"),
    `[${variant}] Security Analyst certificate`
  );
  assert(e.state.chapter >= 10, `[${variant}] chapter advanced`);
}

console.log("\n[48] CHAPTER 10 LAB e8_lab");
{
  const e = completeChapter9Ready();
  assert(e.state.missions["e8_lab"].status === "available", "e8_lab unlocked after chapter 9");
  e.startMission("e8_lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  const marie = run(e, "PC-MARIE", "ping 10.0.0.10").join("\n");
  assert(noLoss(marie), "Marie still reaches DNS");
  e.sendChat("soc", "containment hote, paie OK");
  assert(e.state.missions["e8_lab"].status === "completed", "e8_lab completed");
}

console.log("\n[48b] CHAPTER 10 ERROR — kill payroll");
{
  const e = completeChapter9Ready();
  e.startMission("e8_lab");
  assert(e.state.pendingDecision?.id === "e8_cut", "cut-finance decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e8_lab"].errorKeys.includes("kill_payroll"), "kill_payroll recorded");
  run(e, "RTR-HQ", "sudo iptables -D FW-IR-PAY");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  e.sendChat("soc", "paie retablie");
  assert(e.state.missions["e8_lab"].status === "completed", "still completable");
  assert(e.state.missions["e8_lab"].score < 100, "score penalized");
}

console.log("\n[49] CHAPTER 10 MISSION e8_ir");
{
  const e = completeChapter9Ready();
  completeE8Lab(e);
  e.startMission("e8_ir");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e8_ir.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "PC-PAUL", "grep beacon /var/log/syslog");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  e.sendChat("soc", "timeline + isolate, paie intacte");
  assert(e.state.missions["e8_ir"].status === "completed", "e8_ir completed");
}

for (const variant of ["isolate", "payroll", "comms"] as const) {
  console.log(`\n[50] SIM e8_sim variant=${variant}`);
  const e = completeChapter9Ready();
  completeE8Lab(e);
  completeE8Ir(e);
  e.startMission("e8_sim", variant);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.e8_sim.mailSubject")!;
  e.readMail(examMail.id);
  e.answerDecision("A");
  if (variant === "isolate" || variant === "comms") {
    run(e, "WS-001", "sudo edr isolate PC-PAUL");
  } else {
    run(e, "RTR-HQ", "sudo iptables -D FW-IR-PAY");
  }
  e.sendChat("soc", "rapport IR");
  const s = e.state.missions["e8_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Incident Responder"),
    `[${variant}] Incident Responder certificate`
  );
  assert(e.state.chapter >= 11, `[${variant}] chapter advanced`);
}

console.log("\n[51] OLD SAVE — missing e7/e8 runtimes still start");
{
  const e = completeChapter8Ready();
  delete e.state.missions["e7_lab"];
  delete e.state.missions["e7_ioc"];
  delete e.state.missions["e7_sim"];
  e.startMission("e7_lab");
  assert(e.state.activeMissionId === "e7_lab", "e7_lab starts from a save that lacked L2 runtimes");
  assert(Array.isArray(e.state.world.iocs), "iocs hydrated");
}

console.log("\n[52] CHAPTER 11 LAB e9_lab — start, acquire, timeline");
{
  const e = completeChapter10Ready();
  assert(e.state.missions["e9_lab"].status === "available", "e9_lab unlocked after chapter 10");
  e.startMission("e9_lab");
  assert(e.state.activeMissionId === "e9_lab", "e9_lab starts");
  assert(e.state.openWindows.includes("soc"), "SOC workspace opened on lab start");
  assert(e.state.openWindows.includes("terminal"), "terminal opened on lab start");
  if (e.state.pendingDecision) e.answerDecision("B");
  const acq = run(e, "WS-001", "sudo acquire PC-PAUL").join("\n");
  assert(acq.includes("paul.timeline"), "acquire prints timeline path");
  assert((e.state.world.evidence ?? []).includes("PC-PAUL"), "PC-PAUL in evidence");
  const tl = run(e, "WS-001", `cat ${TIMELINE_FILE}`).join("\n");
  assert(tl.includes("horiz0n") && tl.toLowerCase().includes("initial"), "timeline names initial access");
  const lsEv = run(e, "WS-001", "ls /opt/horizon/evidence").join("\n");
  assert(lsEv.includes("paul.timeline"), "evidence dir lists artifacts");
  e.sendChat("soc", "timeline lue");
  assert(e.state.missions["e9_lab"].status === "completed", "e9_lab completed");
  assert(e.state.badges.includes("dfir_scribe"), "badge dfir_scribe");
}

console.log("\n[52b] CHAPTER 11 ERROR — wipe disk");
{
  const e = completeChapter10Ready();
  e.startMission("e9_lab");
  assert(e.state.pendingDecision?.id === "e9_wipe", "wipe-disk decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e9_lab"].errorKeys.includes("wipe_disk"), "wipe_disk recorded");
  run(e, "WS-001", "sudo acquire PC-PAUL");
  run(e, "WS-001", `cat ${TIMELINE_FILE}`);
  e.sendChat("soc", "quand meme");
  assert(e.state.missions["e9_lab"].status === "completed", "still completable");
  assert(e.state.missions["e9_lab"].score < 100, "score penalized");
}

console.log("\n[53] CHAPTER 11 MISSION e9_scope — mail + start");
{
  const e = completeChapter10Ready();
  completeE9Lab(e);
  e.startMission("e9_scope");
  assert(e.state.activeMissionId === "e9_scope", "e9_scope starts");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e9_scope.mailSubject");
  assert(!!mail, "e9_scope mail delivered on start");
  assert(e.state.openWindows.includes("mail"), "mail workspace opened");
  assert(e.state.openWindows.includes("soc"), "SOC opened for DFIR mission");
  e.readMail(mail!.id);
  assert(e.state.pendingDecision?.id === "e9s_dump", "scope call shown after mail-read");
  e.answerDecision("A");
  run(e, "PC-PAUL", "grep horiz0n /var/log/syslog");
  run(e, "WS-001", "sudo acquire PC-PAUL");
  e.sendChat("soc", "Paul only");
  assert(e.state.missions["e9_scope"].status === "completed", "e9_scope completed");
}

console.log("\n[53b] CHAPTER 11 ERROR — image payroll");
{
  const e = completeChapter10Ready();
  completeE9Lab(e);
  e.startMission("e9_scope");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e9_scope.mailSubject")!;
  e.readMail(mail.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo acquire PC-MARIE");
  assert(e.state.missions["e9_scope"].errorKeys.includes("image_payroll"), "image_payroll recorded");
  run(e, "WS-001", "sudo acquire PC-PAUL");
  e.sendChat("soc", "scope corrige");
  assert(e.state.missions["e9_scope"].status === "completed", "still completable after overscope");
  assert(e.state.missions["e9_scope"].score < 100, "score penalized");
}

for (const variant of ["auth", "scope", "hash"] as const) {
  console.log(`\n[54] SIM e9_sim variant=${variant}`);
  const e = completeChapter10Ready();
  completeE9Lab(e);
  completeE9Scope(e);
  e.startMission("e9_sim", variant);
  assert(e.state.activeMissionId === "e9_sim", `[${variant}] sim starts`);
  const examMail = e.state.mails.find((m) => m.subjectKey === "missions.e9_sim.mailSubject");
  assert(!!examMail, `[${variant}] exam mail delivered`);
  e.readMail(examMail!.id);
  e.answerDecision("A");
  if (variant === "auth") run(e, "PC-PAUL", "grep horiz0n /var/log/syslog");
  else if (variant === "scope") run(e, "WS-001", "sudo acquire PC-PAUL");
  else {
    run(e, "WS-001", "sudo acquire PC-PAUL");
    const hashOut = run(e, "WS-001", `sha256sum ${TIMELINE_FILE}`).join("\n");
    assert(hashOut.includes(EVIDENCE_HASH), "[hash] evidence hash printed");
  }
  e.sendChat("soc", "rapport DFIR");
  const s = e.state.missions["e9_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "DFIR Analyst"),
    `[${variant}] DFIR Analyst certificate`
  );
  assert(e.state.chapter >= 12, `[${variant}] chapter advanced`);
}

console.log("\n[55] OLD SAVE — missing e9 runtimes still start");
{
  const e = completeChapter10Ready();
  delete e.state.missions["e9_lab"];
  delete e.state.missions["e9_scope"];
  delete e.state.missions["e9_sim"];
  e.startMission("e9_lab");
  assert(e.state.activeMissionId === "e9_lab", "e9_lab starts from a save that lacked DFIR runtimes");
  assert(Array.isArray(e.state.world.evidence), "evidence hydrated");
}

console.log("\n[56] CHAPTER 12 LAB e10_lab — VITRINE");
{
  const e = completeChapter11Ready();
  assert(e.state.missions["e10_lab"].status === "available", "e10_lab unlocked after DFIR");
  e.startMission("e10_lab");
  assert(e.state.activeMissionId === "e10_lab", "e10_lab starts");
  assert(e.state.openWindows.includes("browser"), "browser workspace opened");
  assert(e.state.openWindows.includes("terminal"), "terminal workspace opened");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  run(e, "WS-001", "sudo nginx autoindex off");
  const head = run(e, "WS-001", "curl -I http://astral.horizon.local").join("\n");
  assert(head.includes("Strict-Transport-Security"), "curl -I shows HSTS");
  e.sendChat("soc", "vitrine durcie");
  assert(e.state.missions["e10_lab"].status === "completed", "e10_lab completed");
  assert(e.state.badges.includes("astral_vitrine"), "VITRINE badge");
}

console.log("\n[56b] CHAPTER 12 ERROR — open_dir");
{
  const e = completeChapter11Ready();
  e.startMission("e10_lab");
  assert(e.state.pendingDecision?.id === "e10_open", "open-dir decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e10_lab"].errorKeys.includes("open_dir"), "open_dir recorded");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  run(e, "WS-001", "sudo nginx autoindex off");
  e.sendChat("soc", "quand meme");
  assert(e.state.missions["e10_lab"].status === "completed", "still completable");
  assert(e.state.missions["e10_lab"].score < 100, "score penalized");
}

console.log("\n[57] CHAPTER 12 MISSION e10_web — mail + start");
{
  const e = completeChapter11Ready();
  completeE10Lab(e);
  e.startMission("e10_web");
  assert(e.state.activeMissionId === "e10_web", "e10_web starts");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e10_web.mailSubject");
  assert(!!mail, "e10_web mail delivered on start");
  assert(e.state.openWindows.includes("mail"), "mail workspace opened");
  e.readMail(mail!.id);
  assert(e.state.pendingDecision?.id === "e10w_call", "tls call shown after mail-read");
  e.answerDecision("A");
  run(e, "WS-001", "sudo nginx ssl_certificate /etc/nginx/ssl/astral.crt");
  run(e, "WS-001", "sudo nginx proxy_pass http://127.0.0.1:8080");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  e.sendChat("soc", "tls ok");
  assert(e.state.missions["e10_web"].status === "completed", "e10_web completed");
}

for (const variant of ["headers", "tls", "proxy"] as const) {
  console.log(`\n[58] SIM e10_sim variant=${variant}`);
  const e = completeChapter11Ready();
  completeE10Lab(e);
  completeE10Web(e);
  completeE10Sim(e, variant);
  const s = e.state.missions["e10_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "AppSec Defender"),
    `[${variant}] AppSec Defender certificate`
  );
  assert(e.state.chapter >= 13, `[${variant}] chapter advanced`);
}

console.log("\n[59] CHAPTER 13 LAB e11_lab — ORBIT");
{
  const e = completeChapter12Ready();
  e.startMission("e11_lab");
  assert(e.state.activeMissionId === "e11_lab", "e11_lab starts");
  if (e.state.pendingDecision) e.answerDecision("B");
  const desc = run(e, "WS-001", "hzcloud sg describe").join("\n");
  assert(desc.includes("0.0.0.0/0"), "SG starts too wide");
  run(e, "WS-001", "hzcloud sg revoke");
  e.sendChat("soc", "sg ferme");
  assert(e.state.missions["e11_lab"].status === "completed", "e11_lab completed");
  assert(e.state.badges.includes("orbit_cloud"), "ORBIT badge");
}

console.log("\n[60] CHAPTER 13 MISSION e11_iam");
{
  const e = completeChapter12Ready();
  completeE11Lab(e);
  e.startMission("e11_iam");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e11_iam.mailSubject");
  assert(!!mail, "e11_iam mail delivered");
  e.readMail(mail!.id);
  e.answerDecision("A");
  const gitOut = run(e, "WS-001", "git log").join("\n");
  assert(gitOut.includes("hz_live_not_a_real_secret"), "fictional git token shown");
  run(e, "WS-001", "hzcloud iam detach");
  run(e, "WS-001", "hzcloud secret rotate");
  e.sendChat("soc", "iam secret");
  assert(e.state.missions["e11_iam"].status === "completed", "e11_iam completed");
}

for (const variant of ["sg", "iam", "secret"] as const) {
  console.log(`\n[61] SIM e11_sim variant=${variant}`);
  const e = completeChapter12Ready();
  completeE11Lab(e);
  completeE11Iam(e);
  completeE11Sim(e, variant);
  const s = e.state.missions["e11_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Cloud Security Engineer"),
    `[${variant}] Cloud Security Engineer certificate`
  );
  assert(e.state.chapter >= 14, `[${variant}] chapter advanced`);
}

console.log("\n[62] CHAPTER 14 LAB e12_lab — BASTION");
{
  const e = completeChapter13Ready();
  e.startMission("e12_lab");
  assert(e.state.openWindows.includes("network"), "network workspace opened");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo bastion enable");
  run(e, "WS-001", "sudo ot isolate");
  e.sendChat("soc", "bastion ot");
  assert(e.state.missions["e12_lab"].status === "completed", "e12_lab completed");
  assert(e.state.badges.includes("bastion_arch"), "BASTION badge");
}

console.log("\n[63] CHAPTER 14 MISSION e12_zt");
{
  const e = completeChapter13Ready();
  completeE12Lab(e);
  e.startMission("e12_zt");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e12_zt.mailSubject");
  assert(!!mail, "e12_zt mail delivered");
  e.readMail(mail!.id);
  e.answerDecision("A");
  run(e, "WS-001", "sudo bastion enable");
  run(e, "WS-001", "sudo zt enable");
  e.sendChat("soc", "zt ok");
  assert(e.state.missions["e12_zt"].status === "completed", "e12_zt completed");
}

for (const variant of ["bastion", "ot", "zt"] as const) {
  console.log(`\n[64] SIM e12_sim variant=${variant}`);
  const e = completeChapter13Ready();
  completeE12Lab(e);
  completeE12Zt(e);
  completeE12Sim(e, variant);
  const s = e.state.missions["e12_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "Security Engineer"),
    `[${variant}] Security Engineer certificate`
  );
  assert(e.state.chapter >= 15, `[${variant}] chapter advanced`);
}

console.log("\n[65] CHAPTER 15 LAB e13_lab — MANDAT");
{
  const e = completeChapter14Ready();
  e.startMission("e13_lab");
  assert(e.state.openWindows.includes("mail"), "mail opened for GRC lab");
  assert(e.state.openWindows.includes("chat"), "chat opened for GRC lab");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "hzpolicy risk close ASTRAL-R1");
  run(e, "WS-001", "hzpolicy sign MANDAT-15");
  e.sendChat("itsupport", "risque clos");
  assert(e.state.missions["e13_lab"].status === "completed", "e13_lab completed");
  assert(e.state.badges.includes("mandat_grc"), "MANDAT badge");
}

console.log("\n[66] CHAPTER 15 MISSION e13_audit");
{
  const e = completeChapter14Ready();
  completeE13Lab(e);
  e.startMission("e13_audit");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e13_audit.mailSubject");
  assert(!!mail, "e13_audit mail delivered");
  e.readMail(mail!.id);
  e.answerDecision("A");
  run(e, "WS-001", "hzpolicy supplier hold VENDOR-X");
  run(e, "WS-001", "hzpolicy sign MANDAT-15");
  e.sendChat("itsupport", "hold ok");
  assert(e.state.missions["e13_audit"].status === "completed", "e13_audit completed");
}

for (const variant of ["risk", "policy", "supplier"] as const) {
  console.log(`\n[67] SIM e13_sim variant=${variant}`);
  const e = completeChapter14Ready();
  completeE13Lab(e);
  completeE13Audit(e);
  completeE13Sim(e, variant);
  const s = e.state.missions["e13_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "GRC Practitioner"),
    `[${variant}] GRC Practitioner certificate`
  );
  assert(e.state.chapter >= 16, `[${variant}] chapter advanced`);
}

console.log("\n[68] OLD SAVE — missing e10/e13 runtimes still start");
{
  const e = completeChapter11Ready();
  delete e.state.missions["e10_lab"];
  delete e.state.missions["e10_web"];
  delete e.state.missions["e10_sim"];
  e.startMission("e10_lab");
  assert(e.state.activeMissionId === "e10_lab", "e10_lab starts from a save that lacked VITRINE runtimes");
  assert(!!e.state.world.legend, "legend hydrated");
}

console.log("\n[69] CHAPTER 16 LAB e14_lab — APOGEE");
{
  const e = completeChapter15Ready();
  assert(e.state.missions["e14_lab"].status === "available", "e14_lab unlocked after GRC");
  e.startMission("e14_lab");
  assert(e.state.activeMissionId === "e14_lab", "e14_lab starts");
  assert(e.state.openWindows.includes("soc"), "SOC workspace opened");
  assert(e.state.openWindows.includes("terminal"), "terminal opened");
  if (e.state.pendingDecision) e.answerDecision("B");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  run(e, "WS-001", "sudo nginx autoindex off");
  e.sendChat("soc", "apogee contain");
  assert(e.state.missions["e14_lab"].status === "completed", "e14_lab completed");
  assert(e.state.badges.includes("apogee_capstone"), "APOGEE badge");
}

console.log("\n[69b] CHAPTER 16 ERROR — cut_all");
{
  const e = completeChapter15Ready();
  e.startMission("e14_lab");
  assert(e.state.pendingDecision?.id === "e14_cut", "cut-all decision shown");
  e.answerDecision("A");
  e.closeLearning();
  assert(e.state.missions["e14_lab"].errorKeys.includes("cut_all"), "cut_all recorded");
  run(e, "WS-001", "sudo edr isolate PC-PAUL");
  run(e, "WS-001", "sudo nginx add_header Strict-Transport-Security");
  run(e, "WS-001", "sudo nginx autoindex off");
  e.sendChat("soc", "quand meme");
  assert(e.state.missions["e14_lab"].status === "completed", "still completable");
  assert(e.state.missions["e14_lab"].score < 100, "score penalized");
}

console.log("\n[70] CHAPTER 16 MISSION e14_cross");
{
  const e = completeChapter15Ready();
  completeE14Lab(e);
  e.startMission("e14_cross");
  const mail = e.state.mails.find((m) => m.subjectKey === "missions.e14_cross.mailSubject");
  assert(!!mail, "e14_cross mail delivered");
  assert(e.state.openWindows.includes("mail"), "mail workspace opened");
  e.readMail(mail!.id);
  e.answerDecision("A");
  run(e, "WS-001", "hzcloud sg revoke");
  run(e, "WS-001", "sudo bastion enable");
  run(e, "WS-001", "sudo zt enable");
  e.sendChat("soc", "siege tient");
  assert(e.state.missions["e14_cross"].status === "completed", "e14_cross completed");
}

for (const variant of ["contain", "portal", "govern"] as const) {
  console.log(`\n[71] SIM e14_sim variant=${variant}`);
  const e = completeChapter15Ready();
  completeE14Lab(e);
  completeE14Cross(e);
  completeE14Sim(e, variant);
  const s = e.state.missions["e14_sim"];
  assert(s.status === "completed", `[${variant}] sim completed`);
  assert(
    e.state.certificates.some((c) => c.titleKey === "HORIZON Professional"),
    `[${variant}] HORIZON Professional certificate`
  );
  assert(e.state.chapter >= 16, `[${variant}] chapter stays at capstone`);
}

console.log("\n[72] OLD SAVE — missing e14 runtimes still start");
{
  const e = completeChapter15Ready();
  delete e.state.missions["e14_lab"];
  delete e.state.missions["e14_cross"];
  delete e.state.missions["e14_sim"];
  e.startMission("e14_lab");
  assert(e.state.activeMissionId === "e14_lab", "e14_lab starts from a save that lacked APOGEE runtimes");
}

console.log(failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
