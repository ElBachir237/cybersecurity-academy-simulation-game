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

console.log(failures === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
