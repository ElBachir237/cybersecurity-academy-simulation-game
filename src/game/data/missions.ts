// ============================================================
// HORIZON CYBER ACADEMY — Mission definitions
// Chapter 1 (First Day): guided lab -> real mission -> solo exam
// Chapter 2: subnet calculator lab.
// Every step is data: enter hooks build the world (mails, chats,
// calls, notifications) and handlers validate professional
// reflexes rather than flag hunting.
// ============================================================

import type {
  EngineEvent,
  MissionDef,
  MissionRuntime,
  DebriefData,
  GameState,
} from "../types";
import { resolveName } from "../terminal";
import type { TFn } from "../i18n";

// ---------------- event matching helpers ----------------
const baseCmd = (e: EngineEvent): string | undefined => {
  const argv = e.argv ?? [];
  return argv[0] === "sudo" ? argv[1] : argv[0];
};

const cmdIs = (e: EngineEvent, ...names: string[]): boolean =>
  e.type === "cmd" && names.includes(baseCmd(e) ?? "");

const argAt = (e: EngineEvent, i: number): string | undefined => {
  const argv = e.argv ?? [];
  // argv[0] is the command (or "sudo"); arguments start after it.
  const off = argv[0] === "sudo" ? 2 : 1;
  return argv[off + i];
};

const onHost = (e: EngineEvent, host: string): boolean =>
  e.type === "cmd" && e.hostId === host;

const ranOn = (e: EngineEvent, host: string, ...names: string[]): boolean =>
  cmdIs(e, ...names) && onHost(e, host);

// ============================================================
// CHAPTER 1 — LAB: "First workstation" (guided)
// ============================================================
const c1_lab: MissionDef = {
  id: "c1_lab",
  chapter: 1,
  kind: "lab",
  skillIds: ["terminal", "network_basics", "dns"],
  prereq: [],
  difficulty: 1,
  hasVariants: false,
  estimateMin: 12,
  titleKey: "missions.c1_lab.title",
  briefKey: "missions.c1_lab.brief",
  onStart: (fx, state) => {
    // Fresh fault: WS-001 points at a decommissioned DNS server.
    fx.mutateHost("WS-001", (h) => {
      h.dns = ["192.168.1.53"];
      h.ifaces.eth0 = { state: "up", dhcp: false, ip: "192.168.10.24", cidr: 24, gw: "192.168.10.1" };
    });
    delete state.vfs["WS-001"];
    fx.objective("objectives.lab_intro");
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("objectives.lab_intro");
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.missionReady",
          kind: "system",
          linkMission: "c1_lab",
        });
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "objectives.lab_diagnose",
      tasks: [
        { id: "t1", labelKey: "missions.c1_lab.t1", hintKey: "missions.c1_lab.h1" },
        { id: "t2", labelKey: "missions.c1_lab.t2", hintKey: "missions.c1_lab.h2" },
        { id: "t3", labelKey: "missions.c1_lab.t3", hintKey: "missions.c1_lab.h3" },
        { id: "t4", labelKey: "missions.c1_lab.t4", hintKey: "missions.c1_lab.h4" },
        { id: "t5", labelKey: "missions.c1_lab.t5", hintKey: "missions.c1_lab.h5" },
        { id: "t6", labelKey: "missions.c1_lab.t6", hintKey: "missions.c1_lab.h6" },
        { id: "t7", labelKey: "missions.c1_lab.t7", hintKey: "missions.c1_lab.h7" },
        { id: "t8", labelKey: "missions.c1_lab.t8", hintKey: "missions.c1_lab.h8" },
        { id: "t9", labelKey: "missions.c1_lab.t9", hintKey: "missions.c1_lab.h9" },
        { id: "t10", labelKey: "missions.c1_lab.t10", hintKey: "missions.c1_lab.h10" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const ws = state.world.hosts["WS-001"];
        if (e.type === "app-opened" && e.app === "terminal") done.push("t1");
        if (ranOn(e, "WS-001", "help")) done.push("t2");
        if (ranOn(e, "WS-001", "whoami") || ranOn(e, "WS-001", "hostname")) {
          const tasks = mission.tasks;
          if (
            (e.argv ?? []).includes("whoami") ||
            (e.argv ?? []).includes("hostname")
          ) {
            // both counted individually below via state
          }
          if (!tasks.t3_whomai?.done && baseCmd(e) === "whoami") done.push("t3_whomai");
          if (!tasks.t3_hostname?.done && baseCmd(e) === "hostname") done.push("t3_hostname");
          if (
            (tasks.t3_whomai?.done || done.includes("t3_whomai")) &&
            (tasks.t3_hostname?.done || done.includes("t3_hostname"))
          )
            done.push("t3");
        }
        if (ranOn(e, "WS-001", "ip") && (e.argv ?? []).some((a) => a === "addr" || a === "a"))
          done.push("t4");
        if (ranOn(e, "WS-001", "ping") && argAt(e, 0) === "192.168.10.1")
          done.push("t5");
        if (ranOn(e, "WS-001", "ping") && argAt(e, 0) === "10.0.0.10")
          done.push("t6");
        if (ranOn(e, "WS-001", "ping") && argAt(e, 0) === "intranet.horizon") {
          if (ws && ws.dns[0] !== "10.0.0.10") done.push("t7");
          if (ws && ws.dns[0] === "10.0.0.10" && resolveName("intranet.horizon", ws, state))
            done.push("t10");
        }
        if (
          ranOn(e, "WS-001", "curl") &&
          (argAt(e, 0) ?? "").includes("intranet.horizon") &&
          ws?.dns[0] === "10.0.0.10"
        )
          done.push("t10");
        if (
          ranOn(e, "WS-001", "cat") &&
          argAt(e, 0) === "/etc/resolv.conf"
        )
          done.push("t8");
        if (
          e.type === "file-written" &&
          e.hostId === "WS-001" &&
          e.path === "/etc/resolv.conf" &&
          state.world.hosts["WS-001"]?.dns.includes("10.0.0.10")
        ) {
          done.push("t9");
          fx.sound("success");
        }
        const unique = done.filter(
          (id) => id.startsWith("t3_") || !mission.tasks[id]?.done
        );
        const real = unique.filter((id) => !id.startsWith("t3_"));
        const complete =
          real.includes("t10") ||
          ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10"].every(
            (id) => real.includes(id) || mission.tasks[id]?.done
          );
        return { doneTasks: unique, complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(100);
        fx.awardBadge("first_network");
        fx.awardBadge("dns_detective");
        fx.skill("terminal", "practice", 20);
        fx.skill("network_basics", "learning", 15);
        fx.skill("dns", "learning", 15);
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.missionReady",
          body: "Marie n'a plus Internet",
          kind: "system",
          linkMission: "c1_mission",
        });
        fx.chat("itsupport", "lena", fx.t("missions.c1_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    return {
      missionId: "c1_lab",
      titleKey: "missions.c1_lab.title",
      outcome: mission.hintsUsed > 3 ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "terminal", level: "practice" },
        { id: "network_basics", level: "learning" },
        { id: "dns", level: "learning" },
      ],
      skillsToReview: [],
      methodKey: "missions.c1_lab.method",
      nextStepKey: "missions.c1_lab.next",
      report: [
        "RAPPORT — Diagnostic du poste WS-001",
        "------------------------------------------------------------",
        `Score: ${score}/100 | Indices: ${mission.hintsUsed}`,
        "Cause racine: /etc/resolv.conf pointait vers un serveur DNS",
        "mis hors service (192.168.1.53).",
        "Correction: nameserver 10.0.0.10 (DNS-01).",
        "Vérification: ping intranet.horizon + curl intranet.horizon.",
        "------------------------------------------------------------",
      ].join("\n"),
    };
  },
};

// ============================================================
// CHAPTER 1 — MISSION: "Marie has no Internet"
// ============================================================
const c1_mission: MissionDef = {
  id: "c1_mission",
  chapter: 1,
  kind: "mission",
  skillIds: ["dhcp", "services", "network_diag"],
  prereq: ["c1_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 15,
  titleKey: "missions.c1_mission.title",
  briefKey: "missions.c1_mission.brief",
  onStart: (fx, state) => {
    // Fresh fault: PC-MARIE's network service failed -> no DHCP lease.
    fx.mutateHost("PC-MARIE", (h) => {
      h.ifaces.eth0 = { state: "up", dhcp: true };
      h.services["systemd-networkd"] = "failed";
      h.logs.push(
        "Sep 12 09:02:40 pc-marie dhclient[412]: No DHCPOFFERS received.",
        "Sep 12 09:03:02 pc-marie systemd[1]: systemd-networkd.service: Failed with result 'exit-code'."
      );
    });
    delete state.vfs["PC-MARIE"];
    // Undo any previous blast radius.
    fx.setWorld((w) => {
      w.financeOutage = false;
      w.tickets = w.tickets.filter((t) => t.id !== "IT-1043" && t.id !== "IT-1044");
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("objectives.mission_intel");
        fx.mail({
          from: "itsd",
          subjectKey: "missions.c1_mission.mailTicketSubject",
          bodyKey: "missions.c1_mission.mailTicketBody",
        });
        fx.chat("itsupport", "marie", fx.t("missions.c1_mission.chatMarie1"));
        fx.chat("itsupport", "marie", fx.t("missions.c1_mission.chatMarie2"));
        fx.notify({
          severity: "high",
          source: "IT Service Desk",
          titleKey: "missions.c1_mission.mailTicketSubject",
          kind: "it",
          linkMission: "c1_mission",
        });
      },
    },
    {
      id: "call",
      type: "decision",
      decision: {
        id: "c1m_call",
        kind: "call",
        speaker: "marie",
        contextKey: "missions.c1_mission.callContext",
        questionKey: "missions.c1_mission.callQuestion",
        options: [
          {
            id: "A",
            labelKey: "missions.c1_mission.callA",
            consequenceKey: "missions.c1_mission.callConsequenceA",
            whyKey: "missions.c1_mission.callConsequenceA",
            rep: -3,
          },
          {
            id: "B",
            labelKey: "missions.c1_mission.callB",
            correct: true,
            consequenceKey: "missions.c1_mission.callConsequenceB",
            whyKey: "missions.c1_mission.callConsequenceB",
            rep: 3,
          },
          {
            id: "C",
            labelKey: "missions.c1_mission.callC",
            consequenceKey: "missions.c1_mission.callConsequenceC",
            whyKey: "missions.c1_mission.callConsequenceC",
            rep: -5,
          },
        ],
      },
      enter: (fx) => {
        fx.sound("phone");
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "objectives.mission_diag",
      tasks: [
        { id: "t1", labelKey: "missions.c1_mission.t1", hintKey: "missions.c1_mission.h1" },
        { id: "t2", labelKey: "missions.c1_mission.t2", hintKey: "missions.c1_mission.h2" },
        { id: "t3", labelKey: "missions.c1_mission.t3", hintKey: "missions.c1_mission.h3" },
        { id: "t4", labelKey: "missions.c1_mission.t4", hintKey: "missions.c1_mission.h4" },
        { id: "t5", labelKey: "missions.c1_mission.t5", hintKey: "missions.c1_mission.h5" },
        { id: "t6", labelKey: "missions.c1_mission.t6", hintKey: "missions.c1_mission.h6" },
        { id: "t7", labelKey: "missions.c1_mission.t7", hintKey: "missions.c1_mission.h7" },
        { id: "t8", labelKey: "missions.c1_mission.t8", hintKey: "missions.c1_mission.h8" },
      ],
      enter: (fx) => {
        fx.objective("objectives.mission_diag");
        fx.chat("itsupport", "marc", fx.t("missions.c1_mission.chatMarc1"));
      },
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const marie = state.world.hosts["PC-MARIE"];
        if (e.type === "mail-read") done.push("t1");
        if (e.type === "chat-sent" && e.channel === "itsupport") done.push("t1");
        if (e.type === "cmd" && e.hostId === "PC-MARIE") done.push("t2");
        if (ranOn(e, "PC-MARIE", "ip")) done.push("t3");
        if (
          ranOn(e, "PC-MARIE", "cat") &&
          (argAt(e, 0) ?? "").includes("syslog")
        )
          done.push("t4");
        if (
          ranOn(e, "PC-MARIE", "systemctl") &&
          argAt(e, 1) === "systemd-networkd"
        )
          done.push("t5");
        if (marie?.services["systemd-networkd"] === "active" && marie.ifaces.eth0?.ip)
          done.push("t6");
        if (
          marie?.ifaces.eth0?.ip &&
          ranOn(e, "PC-MARIE", "ping") &&
          (argAt(e, 0) === "10.0.0.10" || argAt(e, 0) === "intranet.horizon")
        )
          done.push("t7");
        if (
          e.type === "chat-sent" &&
          e.channel === "itsupport" &&
          marie?.ifaces.eth0?.ip
        ) {
          done.push("t8");
          fx.chat("itsupport", "marie", fx.t("missions.c1_mission.chatMarie3"));
          fx.sound("success");
        }
        // side decision: Marc's suggestion appears after the player reads the logs
        if (
          (done.includes("t4") || mission.tasks["t4"]?.done) &&
          !mission.decisions["c1m_dhcp"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c1m_dhcp",
            kind: "decision",
            contextKey: "missions.c1_mission.decisionContext",
            questionKey: "missions.c1_mission.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c1_mission.decA",
                consequenceKey: "missions.c1_mission.decConsequenceA",
                whyKey: "missions.c1_mission.learningWhy",
                rep: -8,
                fx: (fxx, s) => {
                  fxx.setWorld((w) => {
                    w.financeOutage = true;
                    w.tickets.push({
                      id: "IT-1043",
                      severity: "critical",
                      titleKey: "missions.c1_mission.decConsequenceA",
                      from: "Finance (12 postes)",
                      status: "open",
                      createdAt: s.timeMin,
                    });
                    w.tickets.push({
                      id: "IT-1044",
                      severity: "high",
                      titleKey: "missions.c1_mission.decConsequenceA",
                      from: "Marc Aubin",
                      status: "open",
                      createdAt: s.timeMin,
                    });
                  });
                  fxx.notify({
                    severity: "critical",
                    source: "IT Service Desk",
                    titleKey: "missions.c1_mission.decConsequenceA",
                    kind: "it",
                  });
                  fxx.sound("alert");
                },
              },
              {
                id: "B",
                labelKey: "missions.c1_mission.decB",
                correct: true,
                consequenceKey: "missions.c1_mission.decConsequenceB",
                whyKey: "missions.c1_mission.decConsequenceB",
                rep: 2,
              },
              {
                id: "C",
                labelKey: "missions.c1_mission.decC",
                consequenceKey: "missions.c1_mission.decConsequenceC",
                whyKey: "missions.c1_mission.decConsequenceC",
                rep: -2,
              },
            ],
          });
        }
        const complete =
          done.includes("t8") ||
          ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"].every(
            (id) => done.includes(id) || mission.tasks[id]?.done
          );
        return { doneTasks: done, complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(150);
        fx.awardBadge("log_hunter");
        fx.skill("dhcp", "practice", 25);
        fx.skill("services", "learning", 15);
        fx.skill("network_diag", "learning", 20);
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.simReady",
          kind: "system",
          linkMission: "c1_sim",
        });
        fx.sound("unlock");
      },
    },
  ],
  debrief: (state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    const errors: DebriefData["errors"] = mission.errorKeys.includes("dhcp_restart")
      ? [
          {
            whatKey: "missions.c1_mission.learningTitle",
            whyKey: "missions.c1_mission.learningWhy",
          },
        ]
      : [];
    return {
      missionId: "c1_mission",
      titleKey: "missions.c1_mission.title",
      outcome: errors.length || mission.hintsUsed > 3 ? "partial" : "success",
      score,
      maxScore: 100,
      errors,
      skillsValidated: [
        { id: "dhcp", level: "practice" },
        { id: "services", level: "learning" },
        { id: "network_diag", level: "learning" },
      ],
      skillsToReview: errors.length ? ["network_diag"] : [],
      methodKey: "missions.c1_mission.method",
      nextStepKey: "missions.c1_mission.next",
      report: [
        "RAPPORT D'INTERVENTION — Ticket IT-1042 (PC-MARIE)",
        "------------------------------------------------------------",
        `Score: ${score}/100 | Erreurs: ${mission.errors} | Indices: ${mission.hintsUsed}`,
        "Cause racine: service systemd-networkd en échec -> aucun bail DHCP.",
        "Correction: redémarrage du service + dhclient eth0.",
        "Vérification: bail 192.168.20.45 obtenu, ping 10.0.0.10 OK.",
        "Communication: confirmation à Marie dans IT-SUPPORT.",
        "------------------------------------------------------------",
      ].join("\n"),
    };
  },
};

// ============================================================
// CHAPTER 1 — SIMULATION (exam, variants: dns | gw | link)
// ============================================================
const SIM_VARIANTS = ["dns", "gw", "link"] as const;
type SimVariant = (typeof SIM_VARIANTS)[number];

const c1_sim: MissionDef = {
  id: "c1_sim",
  chapter: 1,
  kind: "simulation",
  skillIds: ["network_diag", "dns", "dhcp", "incident_response"],
  prereq: ["c1_mission"],
  difficulty: 3,
  hasVariants: true,
  estimateMin: 12,
  titleKey: "missions.c1_sim.title",
  briefKey: "missions.c1_sim.brief",
  onStart: (fx, state, variant) => {
    const v = (SIM_VARIANTS.includes(variant as SimVariant) ? variant : "dns") as SimVariant;
    // Reset to a clean baseline first so retries with a different variant
    // never keep stale faults from the previous run.
    fx.mutateHost("PC-PAUL", (h) => {
      h.ifaces.eth0 = {
        state: "up",
        dhcp: false,
        ip: "192.168.30.12",
        cidr: 24,
        gw: "192.168.30.1",
      };
      h.dns = ["10.0.0.10"];
      h.services["systemd-networkd"] = "active";
      h.logs = [
        "Sep 12 10:14:02 pc-paul systemd[1]: Starting Network Service...",
        "Sep 12 10:14:03 pc-paul systemd-networkd[301]: eth0: Link UP",
      ];
      // then apply the variant fault
      if (v === "dns") {
        h.dns = ["172.16.0.99"];
        h.logs.push("Sep 12 10:16:40 pc-paul systemd-resolved: upstream 172.16.0.99 unreachable");
      } else if (v === "gw") {
        h.ifaces.eth0.gw = "192.168.30.254";
        h.logs.push("Sep 12 10:16:40 pc-paul systemd-networkd: default route via 192.168.30.254");
      } else {
        h.ifaces.eth0.state = "down";
        h.logs.push("Sep 12 10:16:41 pc-paul kernel: eth0: link down");
      }
    });
    delete state.vfs["PC-PAUL"];
    fx.mail({
      from: "itsd",
      subjectKey: "missions.c1_sim.mailSubject",
      bodyKey: "missions.c1_sim.mailBody",
    });
    fx.chat("itsupport", "paul", fx.t("missions.c1_sim.chatPaul1"));
    fx.chat("itsupport", "paul", fx.t("missions.c1_sim.chatPaul2"));
    fx.notify({
      severity: "critical",
      source: "IT Service Desk",
      titleKey: "missions.c1_sim.mailSubject",
      kind: "it",
      linkMission: "c1_sim",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("objectives.sim_brief");
        fx.sound("phone");
      },
    },
    {
      id: "call",
      type: "decision",
      decision: {
        id: "c1s_call",
        kind: "call",
        speaker: "paul",
        contextKey: "missions.c1_sim.callContext",
        questionKey: "missions.c1_sim.callQuestion",
        options: [
          {
            id: "A",
            labelKey: "missions.c1_sim.callA",
            correct: true,
            consequenceKey: "missions.c1_sim.callConsequenceA",
            whyKey: "missions.c1_sim.callConsequenceA",
            rep: 3,
          },
          {
            id: "B",
            labelKey: "missions.c1_sim.callB",
            consequenceKey: "missions.c1_sim.callConsequenceB",
            whyKey: "missions.c1_sim.callConsequenceB",
            rep: -3,
          },
          {
            id: "C",
            labelKey: "missions.c1_sim.callC",
            consequenceKey: "missions.c1_sim.callConsequenceC",
            whyKey: "missions.c1_sim.callConsequenceC",
            rep: -8,
          },
        ],
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "objectives.sim_fix",
      tasks: [
        { id: "t1", labelKey: "missions.c1_sim.t1" },
        { id: "t2", labelKey: "missions.c1_sim.t2" },
        { id: "t3", labelKey: "missions.c1_sim.t3" },
        { id: "t4", labelKey: "missions.c1_sim.t4" },
        { id: "t5", labelKey: "missions.c1_sim.t5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const paul = state.world.hosts["PC-PAUL"];
        const variant = mission.variant as SimVariant;
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport"))
          done.push("t1");
        if (e.type === "cmd" && e.hostId === "PC-PAUL") {
          // diagnosis requires ping + config inspection
          const cmds = new Set<string>();
          // accumulate via mission-agnostic heuristic: check current command
          if (baseCmd(e) === "ping") cmds.add("ping");
          if (baseCmd(e) === "ip") cmds.add("ip");
          if (baseCmd(e) === "cat") cmds.add("cat");
          if (cmds.size >= 2) done.push("t2");
          if (ranOn(e, "PC-PAUL", "ip") || ranOn(e, "PC-PAUL", "ping")) done.push("t2");
        }
        // variant-specific fix detection (state already updated by engine signals)
        if (variant === "dns" && paul?.dns.includes("10.0.0.10")) done.push("t3");
        if (
          variant === "gw" &&
          paul?.ifaces.eth0?.gw === "192.168.30.1"
        )
          done.push("t3");
        if (variant === "link" && paul?.ifaces.eth0?.state === "up") done.push("t3");
        // verification
        if (
          paul?.ifaces.eth0?.state === "up" &&
          paul?.ifaces.eth0?.ip &&
          paul?.ifaces.eth0?.gw === "192.168.30.1" &&
          paul?.dns.includes("10.0.0.10") &&
          ranOn(e, "PC-PAUL", "ping") &&
          (argAt(e, 0) === "10.0.0.10" || argAt(e, 0) === "intranet.horizon")
        )
          done.push("t4");
        // report
        if (
          e.type === "chat-sent" &&
          e.channel === "itsupport" &&
          (mission.tasks["t4"]?.done || done.includes("t4"))
        ) {
          done.push("t5");
          fx.chat("itsupport", "paul", fx.t("missions.c1_sim.chatPaul3"));
          fx.sound("success");
        }
        const complete =
          done.includes("t5") ||
          ["t1", "t2", "t3", "t4", "t5"].every(
            (id) => done.includes(id) || mission.tasks[id]?.done
          );
        return { doneTasks: done, complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx, state) => {
        const m = state.missions["c1_sim"];
        const clean = m.errors === 0 && m.hintsUsed === 0;
        fx.awardXp(250);
        fx.awardBadge("incident_responder");
        if (clean) fx.awardBadge("methodical");
        fx.skill("network_diag", "competent", 40);
        fx.skill("dns", "competent", 25);
        fx.skill("dhcp", "competent", 25);
        fx.skill("incident_response", "learning", 20);
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.certReady",
          kind: "cert",
        });
        fx.sound("unlock");
      },
    },
  ],
  debrief: (state, mission, t): DebriefData => {
    const v = mission.variant;
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    const errors: DebriefData["errors"] = mission.errorKeys.includes("dhcp_restart")
      ? [
          {
            whatKey: "missions.c1_sim.learningTitle",
            whyKey: "missions.c1_mission.learningWhy",
          },
        ]
      : mission.errorKeys.includes("bad_netplan")
        ? [
            {
              whatKey: "missions.c1_sim.learningTitle",
              whyKey: "missions.c1_sim.learningWhy",
            },
          ]
        : [];
    return {
      missionId: "c1_sim",
      titleKey: "missions.c1_sim.title",
      outcome: errors.length || mission.hintsUsed ? "partial" : "success",
      score,
      maxScore: 100,
      errors,
      skillsValidated: [
        { id: "network_diag", level: "competent" },
        { id: v === "dns" ? "dns" : v === "gw" ? "routing" : "network_basics", level: "competent" },
        { id: "incident_response", level: "learning" },
      ],
      skillsToReview: errors.length ? ["network_diag"] : [],
      methodKey: "missions.c1_sim.method",
      nextStepKey: "missions.c1_sim.next",
      report: [
        t("missions.c1_sim.reportSubject", { host: "PC-PAUL" }),
        "------------------------------------------------------------",
        `Variant: ${v}`,
        `Score: ${score}/100`,
        `Erreurs: ${mission.errors} | Indices: ${mission.hintsUsed}`,
        `Cause racine: ${t(`missions.c1_sim.cause_${v}`)}`,
        "Actions: diagnostic (ip addr / ip route / cat resolv.conf),",
        "correction ciblée, vérification par ping, communication.",
        "------------------------------------------------------------",
      ].join("\n"),
    };
  },
};

// ============================================================
// CHAPTER 2 — LAB: subnet calculator (in Network app)
// ============================================================
const c2_lab: MissionDef = {
  id: "c2_lab",
  chapter: 2,
  kind: "lab",
  skillIds: ["ipv4", "subnetting"],
  prereq: ["c1_lab"],
  difficulty: 1,
  hasVariants: false,
  estimateMin: 10,
  titleKey: "missions.c2_lab.title",
  briefKey: "missions.c2_lab.brief",
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("missions.c2_lab.obj1");
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "chapter2.title",
          kind: "system",
          linkMission: "c2_lab",
        });
      },
    },
    {
      id: "tasks",
      type: "tasks",
      tasks: [{ id: "t1", labelKey: "missions.c2_lab.t1", hintKey: "missions.c2_lab.h1" }],
      handle: ({ fx, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && e.app === "network") done.push("t1_net");
        if (
          e.type === "action" &&
          e.action === "subnet-calc" &&
          ((e.payload?.count as number) ?? 0) >= 3
        )
          done.push("t1");
        const complete = done.includes("t1") || mission.tasks["t1"]?.done;
        return { doneTasks: done, complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(80);
        fx.skill("ipv4", "practice", 15);
        fx.skill("subnetting", "practice", 20);
      },
    },
  ],
  debrief: (state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    return {
      missionId: "c2_lab",
    titleKey: "missions.c2_lab.title",
    outcome: "success",
    score: 100,
    maxScore: 100,
    errors: [],
    skillsValidated: [
      { id: "ipv4", level: "practice" },
      { id: "subnetting", level: "practice" },
    ],
    skillsToReview: [],
    methodKey: "missions.c2_lab.method",
    nextStepKey: "missions.c2_lab.next",
    report: `${t("missions.c2_lab.title")} — ${t("common.completed")}`,
    };
  },
};

// ---------------- Registry ----------------
export const MISSIONS: Record<string, MissionDef> = {
  c1_lab,
  c1_mission,
  c1_sim,
  c2_lab,
};

export function getMission(id: string): MissionDef | undefined {
  return MISSIONS[id];
}

export const MISSION_ORDER = ["c1_lab", "c1_mission", "c1_sim", "c2_lab"];

export function pickSimVariant(attempts: number): string {
  return SIM_VARIANTS[Math.floor(Math.random() * SIM_VARIANTS.length)];
}
