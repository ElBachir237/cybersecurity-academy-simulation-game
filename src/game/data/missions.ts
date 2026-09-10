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
  FxApi,
  HostRuntime,
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
  variants: ["dns", "gw", "link"],
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

// VLAN 40 — 4th floor addressing plan used by chapter 2.
const VLAN40 = {
  network: "192.168.40.0",
  cidr: 26,
  gw: "192.168.40.1",
  hostIp: "192.168.40.24",
  dns: "10.0.0.10",
} as const;

function makePcNour(): HostRuntime {
  return {
    id: "PC-NOUR",
    label: "PC-NOUR — Poste de Nour (4e étage)",
    os: "Ubuntu 22.04 LTS",
    room: "Étage 4 — Bureau 4C",
    ifaces: {
      eth0: {
        state: "up",
        dhcp: false,
        ip: VLAN40.hostIp,
        cidr: VLAN40.cidr,
        gw: VLAN40.gw,
      },
    },
    dns: [VLAN40.dns],
    services: { "systemd-networkd": "active", "systemd-resolved": "active" },
    netplanPath: "/etc/netplan/01-netcfg.yaml",
    logs: [],
  };
}

function ensureVlan40(fx: FxApi, state: GameState) {
  fx.mutateHost("RTR-HQ", (h) => {
    h.ifaces.eth4 = { state: "up", dhcp: false, ip: VLAN40.gw, cidr: VLAN40.cidr };
  });
  if (!state.world.hosts["PC-NOUR"]) {
    fx.setWorld((w) => {
      w.hosts["PC-NOUR"] = makePcNour();
    });
  }
}

function nourOnPlan(state: GameState): boolean {
  const eth = state.world.hosts["PC-NOUR"]?.ifaces.eth0;
  return eth?.ip === VLAN40.hostIp && eth.cidr === VLAN40.cidr && eth.gw === VLAN40.gw;
}

function setNourAddr(
  fx: FxApi,
  ip: string,
  cidr: number,
  gw: string,
  log: string
) {
  fx.mutateHost("PC-NOUR", (h) => {
    h.ifaces.eth0 = { state: "up", dhcp: false, ip, cidr, gw };
    h.dns = [VLAN40.dns];
    h.services["systemd-networkd"] = "active";
    h.logs.push(log);
  });
}

// ============================================================
// CHAPTER 2 — LAB: subnet calculator (in Network app)
// ============================================================
const c2_lab: MissionDef = {
  id: "c2_lab",
  chapter: 2,
  kind: "lab",
  skillIds: ["ipv4", "subnetting"],
  prereq: ["c1_sim"],
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
      tasks: [
        { id: "t1", labelKey: "missions.c2_lab.t1", hintKey: "missions.c2_lab.h1" },
        { id: "t2", labelKey: "missions.c2_lab.t2", hintKey: "missions.c2_lab.h2" },
      ],
      handle: ({ event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && e.app === "network") done.push("t1");
        if (e.type === "action" && e.action === "subnet-calc") {
          const count = (e.payload?.count as number) ?? 0;
          const network = String(e.payload?.network ?? "");
          const cidr = Number(e.payload?.cidr);
          if (count >= 1) done.push("t1");
          if (network === VLAN40.network && cidr === VLAN40.cidr) done.push("t2");
        }
        const complete =
          (done.includes("t2") || mission.tasks["t2"]?.done) &&
          (done.includes("t1") || mission.tasks["t1"]?.done);
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
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.missionReady",
          kind: "system",
          linkMission: "c2_mission",
        });
        fx.sound("unlock");
      },
    },
  ],
  debrief: (state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    return {
      missionId: "c2_lab",
      titleKey: "missions.c2_lab.title",
      outcome: mission.hintsUsed > 3 ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "ipv4", level: "practice" },
        { id: "subnetting", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c2_lab.method",
      nextStepKey: "missions.c2_lab.next",
      report: [
        t("missions.c2_lab.title"),
        "------------------------------------------------------------",
        `Plan VLAN 40 : ${VLAN40.network}/${VLAN40.cidr}`,
        `Passerelle : ${VLAN40.gw} | Broadcast : 192.168.40.63 | Hôtes utiles : 62`,
        "------------------------------------------------------------",
      ].join("\n"),
    };
  },
};

// ============================================================
// CHAPTER 2 — MISSION: Nour is on the wrong subnet
// ============================================================
const c2_mission: MissionDef = {
  id: "c2_mission",
  chapter: 2,
  kind: "mission",
  skillIds: ["ipv4", "subnetting", "routing"],
  prereq: ["c2_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 15,
  titleKey: "missions.c2_mission.title",
  briefKey: "missions.c2_mission.brief",
  onStart: (fx, state) => {
    ensureVlan40(fx, state);
    setNourAddr(
      fx,
      "192.168.10.80",
      24,
      "192.168.10.1",
      "Sep 12 11:18:04 pc-nour systemd-networkd: eth0: address 192.168.10.80/24 (cloned from WS-001 template)"
    );
    delete state.vfs["PC-NOUR"];
    fx.setWorld((w) => {
      w.tickets = w.tickets.filter((t) => t.id !== "IT-2101" && t.id !== "IT-2102");
      w.tickets.push({
        id: "IT-2101",
        severity: "medium",
        titleKey: "missions.c2_mission.mailTicketSubject",
        from: "Nour Benali (Produit)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: "PC-NOUR",
      });
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("missions.c2_mission.obj1");
        fx.mail({
          from: "itsd",
          subjectKey: "missions.c2_mission.mailTicketSubject",
          bodyKey: "missions.c2_mission.mailTicketBody",
        });
        fx.chat("itsupport", "nour", fx.t("missions.c2_mission.chatNour1"));
        fx.chat("itsupport", "lena", fx.t("missions.c2_mission.chatLena1"));
        fx.notify({
          severity: "high",
          source: "IT Service Desk",
          titleKey: "missions.c2_mission.mailTicketSubject",
          kind: "it",
          linkMission: "c2_mission",
        });
      },
    },
    {
      id: "call",
      type: "decision",
      decision: {
        id: "c2m_call",
        kind: "call",
        speaker: "nour",
        contextKey: "missions.c2_mission.callContext",
        questionKey: "missions.c2_mission.callQuestion",
        options: [
          {
            id: "A",
            labelKey: "missions.c2_mission.callA",
            correct: true,
            consequenceKey: "missions.c2_mission.callConsequenceA",
            whyKey: "missions.c2_mission.callConsequenceA",
            rep: 3,
          },
          {
            id: "B",
            labelKey: "missions.c2_mission.callB",
            consequenceKey: "missions.c2_mission.callConsequenceB",
            whyKey: "missions.c2_mission.callConsequenceB",
            rep: -3,
          },
          {
            id: "C",
            labelKey: "missions.c2_mission.callC",
            consequenceKey: "missions.c2_mission.callConsequenceC",
            whyKey: "missions.c2_mission.callConsequenceC",
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
      objectiveKey: "missions.c2_mission.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c2_mission.t1", hintKey: "missions.c2_mission.h1" },
        { id: "t2", labelKey: "missions.c2_mission.t2", hintKey: "missions.c2_mission.h2" },
        { id: "t3", labelKey: "missions.c2_mission.t3", hintKey: "missions.c2_mission.h3" },
        { id: "t4", labelKey: "missions.c2_mission.t4", hintKey: "missions.c2_mission.h4" },
        { id: "t5", labelKey: "missions.c2_mission.t5", hintKey: "missions.c2_mission.h5" },
        { id: "t6", labelKey: "missions.c2_mission.t6", hintKey: "missions.c2_mission.h6" },
        { id: "t7", labelKey: "missions.c2_mission.t7", hintKey: "missions.c2_mission.h7" },
      ],
      enter: (fx) => {
        fx.objective("missions.c2_mission.obj2");
        fx.chat("itsupport", "marc", fx.t("missions.c2_mission.chatMarc1"));
      },
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport"))
          done.push("t1");
        if (e.type === "cmd" && e.hostId === "PC-NOUR") done.push("t2");
        if (ranOn(e, "PC-NOUR", "ip")) done.push("t3");
        if (
          (e.type === "app-opened" && e.app === "network") ||
          (e.type === "action" && e.action === "subnet-calc") ||
          (ranOn(e, "PC-NOUR", "cat") && (argAt(e, 0) ?? "").includes("netplan"))
        )
          done.push("t4");
        if (nourOnPlan(state)) done.push("t5");
        if (
          nourOnPlan(state) &&
          ranOn(e, "PC-NOUR", "ping") &&
          (argAt(e, 0) === VLAN40.gw || argAt(e, 0) === VLAN40.dns)
        )
          done.push("t6");
        if (
          e.type === "chat-sent" &&
          e.channel === "itsupport" &&
          (mission.tasks["t6"]?.done || done.includes("t6"))
        ) {
          done.push("t7");
          fx.chat("itsupport", "nour", fx.t("missions.c2_mission.chatNour2"));
          fx.sound("success");
        }
        if (
          (done.includes("t3") || mission.tasks["t3"]?.done) &&
          !mission.decisions["c2m_leave"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c2m_leave",
            kind: "decision",
            contextKey: "missions.c2_mission.decisionContext",
            questionKey: "missions.c2_mission.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c2_mission.decA",
                consequenceKey: "missions.c2_mission.decConsequenceA",
                whyKey: "missions.c2_mission.learningWhy",
                rep: -6,
                fx: (fxx, s) => {
                  const rt = s.missions["c2_mission"];
                  if (rt && !rt.errorKeys.includes("left_wrong_vlan")) {
                    rt.errors += 1;
                    rt.errorKeys.push("left_wrong_vlan");
                  }
                  fxx.setWorld((w) => {
                    w.tickets.push({
                      id: "IT-2102",
                      severity: "high",
                      titleKey: "missions.c2_mission.decConsequenceA",
                      from: "Lena Kovac (IT)",
                      status: "open",
                      createdAt: s.timeMin,
                      relatedHost: "PC-NOUR",
                    });
                  });
                  fxx.notify({
                    severity: "high",
                    source: "IT",
                    titleKey: "missions.c2_mission.decConsequenceA",
                    kind: "it",
                  });
                  fxx.setLearning({
                    titleKey: "missions.c2_mission.learningTitle",
                    impactKey: "missions.c2_mission.learningImpact",
                    whyKey: "missions.c2_mission.learningWhy",
                    checkKey: "missions.c2_mission.learningCheck",
                  });
                  fxx.sound("alert");
                },
              },
              {
                id: "B",
                labelKey: "missions.c2_mission.decB",
                correct: true,
                consequenceKey: "missions.c2_mission.decConsequenceB",
                whyKey: "missions.c2_mission.decConsequenceB",
                rep: 3,
              },
              {
                id: "C",
                labelKey: "missions.c2_mission.decC",
                consequenceKey: "missions.c2_mission.decConsequenceC",
                whyKey: "missions.c2_mission.decConsequenceC",
                rep: -8,
                fx: (fxx, s) => {
                  const rt = s.missions["c2_mission"];
                  if (rt && !rt.errorKeys.includes("stole_gateway")) {
                    rt.errors += 1;
                    rt.errorKeys.push("stole_gateway");
                  }
                  fxx.setLearning({
                    titleKey: "missions.c2_mission.learningTitleGw",
                    impactKey: "missions.c2_mission.learningImpactGw",
                    whyKey: "missions.c2_mission.learningWhyGw",
                    checkKey: "missions.c2_mission.learningCheckGw",
                  });
                  fxx.sound("alert");
                },
              },
            ],
          });
        }
        const complete =
          done.includes("t7") ||
          ["t1", "t2", "t3", "t4", "t5", "t6", "t7"].every(
            (id) => done.includes(id) || mission.tasks[id]?.done
          );
        return { doneTasks: done, complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(160);
        fx.awardBadge("subnet_planner");
        fx.skill("ipv4", "competent", 25);
        fx.skill("subnetting", "competent", 25);
        fx.skill("routing", "learning", 15);
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.simReady",
          kind: "system",
          linkMission: "c2_sim",
        });
        fx.sound("unlock");
      },
    },
  ],
  debrief: (state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    const leftWrong = mission.decisions["c2m_leave"] === "A";
    const stoleGw = mission.decisions["c2m_leave"] === "C";
    const errors: DebriefData["errors"] = [];
    if (leftWrong) {
      errors.push({
        whatKey: "missions.c2_mission.learningTitle",
        whyKey: "missions.c2_mission.learningWhy",
      });
    }
    if (stoleGw) {
      errors.push({
        whatKey: "missions.c2_mission.learningTitleGw",
        whyKey: "missions.c2_mission.learningWhyGw",
      });
    }
    return {
      missionId: "c2_mission",
      titleKey: "missions.c2_mission.title",
      outcome: errors.length || mission.hintsUsed > 3 ? "partial" : "success",
      score,
      maxScore: 100,
      errors,
      skillsValidated: [
        { id: "ipv4", level: "competent" },
        { id: "subnetting", level: "competent" },
        { id: "routing", level: "learning" },
      ],
      skillsToReview: errors.length ? ["subnetting"] : [],
      methodKey: "missions.c2_mission.method",
      nextStepKey: "missions.c2_mission.next",
      report: [
        t("missions.c2_mission.reportSubject"),
        "------------------------------------------------------------",
        `Score: ${score}/100 | Erreurs: ${mission.errors} | Indices: ${mission.hintsUsed}`,
        "Cause racine: template WS-001 copié → 192.168.10.80/24 au lieu du plan VLAN 40.",
        `Correction: ${VLAN40.hostIp}/${VLAN40.cidr} via ${VLAN40.gw}.`,
        "Vérification: ping passerelle étage + DNS.",
        "------------------------------------------------------------",
      ].join("\n"),
    };
  },
};

// ============================================================
// CHAPTER 2 — SIMULATION (exam, variants: mask | gw | ip)
// ============================================================
const C2_SIM_VARIANTS = ["mask", "gw", "ip"] as const;
type C2SimVariant = (typeof C2_SIM_VARIANTS)[number];

const c2_sim: MissionDef = {
  id: "c2_sim",
  chapter: 2,
  kind: "simulation",
  skillIds: ["ipv4", "subnetting", "routing", "network_diag"],
  prereq: ["c2_mission"],
  difficulty: 3,
  hasVariants: true,
  variants: ["mask", "gw", "ip"],
  estimateMin: 12,
  titleKey: "missions.c2_sim.title",
  briefKey: "missions.c2_sim.brief",
  onStart: (fx, state, variant) => {
    const v = (
      C2_SIM_VARIANTS.includes(variant as C2SimVariant) ? variant : "mask"
    ) as C2SimVariant;
    ensureVlan40(fx, state);
    delete state.vfs["PC-NOUR"];
    if (v === "mask") {
      setNourAddr(
        fx,
        VLAN40.hostIp,
        24,
        VLAN40.gw,
        "Sep 12 14:02:11 pc-nour systemd-networkd: eth0: 192.168.40.24/24 (mask too wide vs plan /26)"
      );
    } else if (v === "gw") {
      setNourAddr(
        fx,
        VLAN40.hostIp,
        VLAN40.cidr,
        "192.168.10.1",
        "Sep 12 14:02:11 pc-nour systemd-networkd: default via 192.168.10.1 (gateway not on-link)"
      );
    } else {
      setNourAddr(
        fx,
        "192.168.10.80",
        VLAN40.cidr,
        VLAN40.gw,
        "Sep 12 14:02:11 pc-nour systemd-networkd: eth0: 192.168.10.80/26 (address outside VLAN 40)"
      );
    }
    fx.mail({
      from: "itsd",
      subjectKey: "missions.c2_sim.mailSubject",
      bodyKey: "missions.c2_sim.mailBody",
    });
    fx.chat("itsupport", "nour", fx.t("missions.c2_sim.chatNour1"));
    fx.notify({
      severity: "critical",
      source: "IT Service Desk",
      titleKey: "missions.c2_sim.mailSubject",
      kind: "it",
      linkMission: "c2_sim",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("missions.c2_sim.obj1");
        fx.sound("phone");
      },
    },
    {
      id: "call",
      type: "decision",
      decision: {
        id: "c2s_call",
        kind: "call",
        speaker: "nour",
        contextKey: "missions.c2_sim.callContext",
        questionKey: "missions.c2_sim.callQuestion",
        options: [
          {
            id: "A",
            labelKey: "missions.c2_sim.callA",
            correct: true,
            consequenceKey: "missions.c2_sim.callConsequenceA",
            whyKey: "missions.c2_sim.callConsequenceA",
            rep: 3,
          },
          {
            id: "B",
            labelKey: "missions.c2_sim.callB",
            consequenceKey: "missions.c2_sim.callConsequenceB",
            whyKey: "missions.c2_sim.callConsequenceB",
            rep: -3,
          },
          {
            id: "C",
            labelKey: "missions.c2_sim.callC",
            consequenceKey: "missions.c2_sim.callConsequenceC",
            whyKey: "missions.c2_sim.callConsequenceC",
            rep: -6,
          },
        ],
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c2_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.c2_sim.t1" },
        { id: "t2", labelKey: "missions.c2_sim.t2" },
        { id: "t3", labelKey: "missions.c2_sim.t3" },
        { id: "t4", labelKey: "missions.c2_sim.t4" },
        { id: "t5", labelKey: "missions.c2_sim.t5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport"))
          done.push("t1");
        if (
          e.type === "cmd" &&
          e.hostId === "PC-NOUR" &&
          (cmdIs(e, "ip") || cmdIs(e, "ping") || cmdIs(e, "cat"))
        )
          done.push("t2");
        if (nourOnPlan(state)) done.push("t3");
        if (
          nourOnPlan(state) &&
          ranOn(e, "PC-NOUR", "ping") &&
          (argAt(e, 0) === VLAN40.gw || argAt(e, 0) === VLAN40.dns)
        )
          done.push("t4");
        if (
          e.type === "chat-sent" &&
          e.channel === "itsupport" &&
          (mission.tasks["t4"]?.done || done.includes("t4"))
        ) {
          done.push("t5");
          fx.chat("itsupport", "nour", fx.t("missions.c2_sim.chatNour2"));
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
        const m = state.missions["c2_sim"];
        const clean = m.errors === 0 && m.hintsUsed === 0;
        fx.awardXp(220);
        if (clean) fx.awardBadge("methodical");
        fx.skill("ipv4", "competent", 30);
        fx.skill("subnetting", "competent", 30);
        fx.skill("routing", "practice", 20);
        fx.skill("network_diag", "competent", 15);
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
    return {
      missionId: "c2_sim",
      titleKey: "missions.c2_sim.title",
      outcome: mission.hintsUsed ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "ipv4", level: "competent" },
        { id: "subnetting", level: "competent" },
        { id: "routing", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c2_sim.method",
      nextStepKey: "missions.c2_sim.next",
      report: [
        t("missions.c2_sim.reportSubject", { host: "PC-NOUR" }),
        "------------------------------------------------------------",
        `Variant: ${v}`,
        `Score: ${score}/100`,
        `Cause racine: ${t(`missions.c2_sim.cause_${v}`)}`,
        `Plan: ${VLAN40.hostIp}/${VLAN40.cidr} via ${VLAN40.gw}`,
        "------------------------------------------------------------",
      ].join("\n"),
    };
  },
};

// ---------------- Registry ----------------
export const MISSIONS: Record<string, MissionDef> = {
  c1_lab,
  c1_mission,
  c1_sim,
  c2_lab,
  c2_mission,
  c2_sim,
};

export function getMission(id: string): MissionDef | undefined {
  return MISSIONS[id];
}

export const MISSION_ORDER = [
  "c1_lab",
  "c1_mission",
  "c1_sim",
  "c2_lab",
  "c2_mission",
  "c2_sim",
];

export function pickSimVariant(attempts: number): string {
  return SIM_VARIANTS[Math.floor(Math.random() * SIM_VARIANTS.length)];
}
