// ============================================================
// HORIZON — End-to-end engine smoke test (Chapter 1 walkthrough)
// Simulates a real player: lab -> mission -> simulation variants
// Run: npx tsx scripts/smoke.ts
// ============================================================

import { GameEngine } from "../src/game/engine";
import { readHostFile } from "../src/game/terminal";
import type { Profile } from "../src/game/types";

function noLoss(out: string): boolean {
  // FR: "0% de perte" / EN: "0% packet loss"
  return out.includes("0% de perte") || out.includes("0% packet loss");
}

function allLoss(out: string): boolean {
  return out.includes("100%") && (out.includes("perte") || out.includes("packet loss"));
}

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ FAIL: ${msg}`);
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
  assert(failPing.includes("échec") || failPing.toLowerCase().includes("dns"), "DNS failure observed before fix");
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
  e.sendChat("itsupport", "PC-MARIE réparé, bail DHCP obtenu.");

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
  e.sendChat("itsupport", "réparé");

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
  e.sendChat("itsupport", "rapport: incident résolu");
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
  e.sendChat("itsupport", "réparé");
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
  e.sendChat("itsupport", "réparé");
  e.startMission("c1_sim", "dns");
  e.answerDecision("A");
  run(e, "PC-PAUL", "ip addr");
  run(e, "PC-PAUL", "ip route");
  e.writeFile("PC-PAUL", "/etc/resolv.conf", "nameserver 10.0.0.10\n");
  run(e, "PC-PAUL", "ping 10.0.0.10");
  e.sendChat("itsupport", "rapport: incident résolu");
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
  e.sendChat("itsupport", "rapport: plan VLAN 40 rétabli");
}

function completeChapter2Ready(): GameEngine {
  const e = newEngine();
  completeChapter2(e);
  return e;
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
  e.sendChat("itsupport", "corrigé malgré tout");
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
  e.sendChat("itsupport", "rapport: plan VLAN 40 rétabli");
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
  assert(e.state.missions["c3_mission"].status === "available", "c3_mission unlocked");
}

console.log("\n[13] CHAPTER 3 MISSION c3_mission");
{
  const e = completeChapter2Ready();
  e.startMission("c3_lab");
  run(e, "WS-001", "sudo iptables -L");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "sudo iptables -D FW-LAB");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
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
  e.sendChat("itsupport", "trou FW-VENDOR fermé, DNS OK");
  assert(e.state.missions["c3_mission"].status === "completed", `c3_mission completed (status=${e.state.missions["c3_mission"].status})`);
  assert(e.state.missions["c3_sim"].status === "available", "c3_sim unlocked");
}

console.log("\n[14] CHAPTER 3 ERROR — open any to Finance");
{
  const e = completeChapter2Ready();
  e.startMission("c3_lab");
  run(e, "WS-001", "sudo iptables -L");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "sudo iptables -D FW-LAB");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
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
  e.sendChat("itsupport", "corrigé malgré tout");
  assert(e.state.missions["c3_mission"].status === "completed", "mission still completable");
  assert(e.state.missions["c3_mission"].score < 100, "score penalized");
}

for (const variant of ["any", "src", "wide"] as const) {
  console.log(`\n[15] SIM c3_sim variant=${variant}`);
  const e = completeChapter2Ready();
  e.startMission("c3_lab");
  run(e, "WS-001", "sudo iptables -L");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "sudo iptables -D FW-LAB");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
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
  e.sendChat("itsupport", "rapport: trou FORWARD fermé");
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

console.log("\n[16] OLD SAVE — missing c3_mission runtime still starts and gets mail");
{
  const e = completeChapter2Ready();
  e.startMission("c3_lab");
  run(e, "WS-001", "sudo iptables -L");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "sudo iptables -D FW-LAB");
  run(e, "WS-001", "ping 192.168.20.45");
  run(e, "WS-001", "ping 10.0.0.10");
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

console.log(failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
