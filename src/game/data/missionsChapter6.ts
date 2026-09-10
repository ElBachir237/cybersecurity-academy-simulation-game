// Chapter 6 — Vendor gear: pfSense, MikroTik, UniFi gateway
import type { DebriefData, GameState, MissionDef } from "../types";
import { ipReachable } from "../terminal";
import {
  GUEST_LAN_ID,
  firewallAllows,
  guestLanRule,
  pfHoleRule,
  PF_HOLE_ID,
} from "./world";

const cmd = (e: { type: string; argv?: string[] }, name: string) =>
  e.type === "cmd" && (e.argv?.[0] ?? "").replace(/^\//, "").toLowerCase() === name.toLowerCase();

const onHost = (e: { type: string; hostId?: string }, host: string) =>
  e.type === "cmd" && e.hostId === host;

const argvHas = (e: { argv?: string[] }, ...needles: string[]) => {
  const argv = (e.argv ?? []).map((a) => a.toLowerCase());
  return needles.every((n) => argv.some((a) => a.includes(n.toLowerCase())));
};

const rosLine = (e: { argv?: string[] }) =>
  (e.argv ?? []).join(" ").replace(/^\//, "").toLowerCase();

function scoreOf(mission: { errors: number; hintsUsed: number }): number {
  return Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
}

function hasRule(state: GameState, id: string): boolean {
  return (state.world.fwRules ?? []).some((r) => r.id === id);
}

function stripRule(w: GameState["world"], id: string) {
  w.fwRules = (w.fwRules ?? []).filter((r) => r.id !== id);
}

function upsertRule(w: GameState["world"], rule: ReturnType<typeof pfHoleRule>) {
  stripRule(w, rule.id);
  w.fwRules = [...(w.fwRules ?? []), rule];
}

function restoreMikrotik(fx: {
  mutateHost: (id: string, fn: (h: GameState["world"]["hosts"][string]) => void) => void;
}) {
  fx.mutateHost("RTR-BR", (h) => {
    h.routes = [{ dst: "0.0.0.0/0", gateway: "172.16.0.1" }];
    h.nat = [{ id: "NAT-1", chain: "srcnat", action: "masquerade", outInterface: "ether1" }];
  });
}

function breakMikrotik(fx: {
  mutateHost: (id: string, fn: (h: GameState["world"]["hosts"][string]) => void) => void;
}) {
  fx.mutateHost("RTR-BR", (h) => {
    h.routes = [];
    h.nat = [];
  });
}

function restoreUdm(fx: {
  mutateHost: (id: string, fn: (h: GameState["world"]["hosts"][string]) => void) => void;
  setWorld: (fn: (w: GameState["world"]) => void) => void;
}) {
  fx.mutateHost("GW-UDM", (h) => {
    h.guestIsolation = true;
  });
  fx.setWorld((w) => stripRule(w, GUEST_LAN_ID));
}

function financeClosed(state: GameState): boolean {
  return !firewallAllows("192.168.10.24", "192.168.20.45", state);
}

function dnsOkFromOffice(state: GameState): boolean {
  const h = state.world.hosts["WS-001"];
  return !!h && ipReachable("10.0.0.10", h, state);
}

function branchIntranetOk(state: GameState): boolean {
  const h = state.world.hosts["PC-LEA"];
  return !!h && ipReachable("10.0.0.20", h, state);
}

function guestLeaks(state: GameState): boolean {
  const h = state.world.hosts["PC-PAUL"];
  return !!h && ipReachable("192.168.10.24", h, state);
}

export const c6_lab: MissionDef = {
  id: "c6_lab",
  chapter: 6,
  kind: "lab",
  skillIds: ["pfsense", "firewall", "network_diag"],
  prereq: ["c5_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.c6_lab.title",
  briefKey: "missions.c6_lab.brief",
  onStart: (fx) => {
    restoreMikrotik(fx);
    restoreUdm(fx);
    fx.setWorld((w) => upsertRule(w, pfHoleRule()));
    fx.objective("missions.c6_lab.obj1");
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("missions.c6_lab.obj1");
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.missionReady",
          kind: "system",
          linkMission: "c6_lab",
        });
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c6_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c6_lab.t1", hintKey: "missions.c6_lab.h1" },
        { id: "t2", labelKey: "missions.c6_lab.t2", hintKey: "missions.c6_lab.h2" },
        { id: "t3", labelKey: "missions.c6_lab.t3", hintKey: "missions.c6_lab.h3" },
        { id: "t4", labelKey: "missions.c6_lab.t4", hintKey: "missions.c6_lab.h4" },
        { id: "t5", labelKey: "missions.c6_lab.t5", hintKey: "missions.c6_lab.h5" },
      ],
      handle: ({ state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && e.app === "terminal") done.push("t1");
        if (onHost(e, "FW-PFS") && (cmd(e, "help") || cmd(e, "pfctl"))) done.push("t1");
        if (onHost(e, "FW-PFS") && cmd(e, "pfctl") && argvHas(e, "-sr")) done.push("t2");
        if (!hasRule(state, PF_HOLE_ID)) done.push("t3");
        if (onHost(e, "FW-PFS") && cmd(e, "easyrule") && argvHas(e, "delete", PF_HOLE_ID.toLowerCase())) {
          done.push("t3");
        }
        if (onHost(e, "WS-001") && cmd(e, "ping") && argvHas(e, "192.168.20.45") && financeClosed(state)) {
          done.push("t4");
        }
        if (financeClosed(state) && dnsOkFromOffice(state)) done.push("t4");
        if (onHost(e, "WS-001") && cmd(e, "ping") && argvHas(e, "10.0.0.10") && dnsOkFromOffice(state)) {
          done.push("t5");
        }
        if (financeClosed(state) && dnsOkFromOffice(state)) done.push("t5");
        const ids = ["t1", "t2", "t3", "t4", "t5"];
        const complete =
          (!hasRule(state, PF_HOLE_ID) && financeClosed(state) && dnsOkFromOffice(state) && (done.includes("t5") || mission.tasks.t5?.done || done.includes("t4"))) ||
          ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(120);
        fx.skill("pfsense", "practice", 25);
        fx.skill("firewall", "practice", 10);
        fx.chat("itsupport", "lena", fx.t("missions.c6_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "c6_lab",
      titleKey: "missions.c6_lab.title",
      outcome: mission.hintsUsed > 3 ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "pfsense", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.c6_lab.method",
      nextStepKey: "missions.c6_lab.next",
      report: t("missions.c6_lab.title") + ` — ${score}/100`,
    };
  },
};

export const c6_mt: MissionDef = {
  id: "c6_mt",
  chapter: 6,
  kind: "mission",
  skillIds: ["mikrotik", "routing", "firewall"],
  prereq: ["c6_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.c6_mt.title",
  briefKey: "missions.c6_mt.brief",
  onStart: (fx, state) => {
    restoreUdm(fx);
    fx.setWorld((w) => stripRule(w, PF_HOLE_ID));
    breakMikrotik(fx);
    fx.setWorld((w) => {
      w.tickets = w.tickets.filter((t) => t.id !== "IT-6101");
      w.tickets.push({
        id: "IT-6101",
        severity: "high",
        titleKey: "missions.c6_mt.mailTicketSubject",
        from: "Léa Moreau (Lyon)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: "RTR-BR",
      });
    });
    fx.mail({
      from: "itsd",
      subjectKey: "missions.c6_mt.mailTicketSubject",
      bodyKey: "missions.c6_mt.mailTicketBody",
    });
    fx.chat("itsupport", "lea", fx.t("missions.c6_mt.chatLea1"));
    fx.notify({
      severity: "high",
      source: "IT Service Desk",
      titleKey: "missions.c6_mt.mailTicketSubject",
      kind: "it",
      linkMission: "c6_mt",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c6_mt.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c6_mt.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c6_mt.t1", hintKey: "missions.c6_mt.h1" },
        { id: "t2", labelKey: "missions.c6_mt.t2", hintKey: "missions.c6_mt.h2" },
        { id: "t3", labelKey: "missions.c6_mt.t3", hintKey: "missions.c6_mt.h3" },
        { id: "t4", labelKey: "missions.c6_mt.t4", hintKey: "missions.c6_mt.h4" },
        { id: "t5", labelKey: "missions.c6_mt.t5", hintKey: "missions.c6_mt.h5" },
        { id: "t6", labelKey: "missions.c6_mt.t6", hintKey: "missions.c6_mt.h6" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c6m_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c6m_call",
            kind: "call",
            speaker: "lea",
            contextKey: "missions.c6_mt.callContext",
            questionKey: "missions.c6_mt.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c6_mt.callA",
                correct: true,
                consequenceKey: "missions.c6_mt.callConsequenceA",
                whyKey: "missions.c6_mt.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.c6_mt.callB",
                consequenceKey: "missions.c6_mt.callConsequenceB",
                whyKey: "missions.c6_mt.callConsequenceB",
                rep: -4,
              },
            ],
          });
        }
        if (onHost(e, "RTR-BR") && rosLine(e).includes("ip address")) done.push("t2");
        if (onHost(e, "RTR-BR") && rosLine(e).includes("ip route print")) done.push("t3");
        const br = state.world.hosts["RTR-BR"];
        if (br?.routes?.some((r) => r.dst === "0.0.0.0/0")) done.push("t4");
        if (br?.nat?.some((n) => n.action === "masquerade")) done.push("t5");
        if (branchIntranetOk(state)) done.push("t6");
        if (e.type === "chat-sent" && e.channel === "itsupport" && branchIntranetOk(state)) done.push("t6");
        if (
          (done.includes("t2") || mission.tasks.t2?.done) &&
          mission.decisions["c6m_call"] &&
          !mission.decisions["c6m_nat"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c6m_nat",
            kind: "decision",
            contextKey: "missions.c6_mt.decisionContext",
            questionKey: "missions.c6_mt.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c6_mt.decA",
                consequenceKey: "missions.c6_mt.decConsequenceA",
                whyKey: "missions.c6_mt.learningWhy",
                rep: -5,
                fx: (fxx, s) => {
                  const rt = s.missions["c6_mt"];
                  if (rt && !rt.errorKeys.includes("skip_nat")) {
                    rt.errors += 1;
                    rt.errorKeys.push("skip_nat");
                  }
                  fxx.setLearning({
                    titleKey: "missions.c6_mt.learningTitle",
                    impactKey: "missions.c6_mt.learningImpact",
                    whyKey: "missions.c6_mt.learningWhy",
                    checkKey: "missions.c6_mt.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.c6_mt.decB",
                correct: true,
                consequenceKey: "missions.c6_mt.decConsequenceB",
                whyKey: "missions.c6_mt.decConsequenceB",
                rep: 5,
              },
            ],
          });
        }
        const complete =
          branchIntranetOk(state) &&
          (e.type === "chat-sent" && e.channel === "itsupport" || mission.tasks.t6?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete: !!complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.awardBadge("vendor_net");
        fx.skill("mikrotik", "practice", 25);
        fx.skill("routing", "practice", 15);
        fx.chat("itsupport", "lena", fx.t("missions.c6_mt.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "c6_mt",
      titleKey: "missions.c6_mt.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "mikrotik", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.c6_mt.method",
      nextStepKey: "missions.c6_mt.next",
      report: t("missions.c6_mt.title") + ` — ${score}/100`,
    };
  },
};

export const c6_unifi: MissionDef = {
  id: "c6_unifi",
  chapter: 6,
  kind: "mission",
  skillIds: ["unifi", "vlan", "wifi", "firewall"],
  prereq: ["c6_mt"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.c6_unifi.title",
  briefKey: "missions.c6_unifi.brief",
  onStart: (fx, state) => {
    restoreMikrotik(fx);
    fx.setWorld((w) => {
      stripRule(w, PF_HOLE_ID);
      upsertRule(w, guestLanRule());
      w.tickets = w.tickets.filter((t) => t.id !== "IT-6102");
      w.tickets.push({
        id: "IT-6102",
        severity: "medium",
        titleKey: "missions.c6_unifi.mailTicketSubject",
        from: "Soriya Chan (SOC)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: "GW-UDM",
      });
    });
    fx.mutateHost("GW-UDM", (h) => {
      h.guestIsolation = false;
    });
    fx.mail({
      from: "soriya",
      subjectKey: "missions.c6_unifi.mailTicketSubject",
      bodyKey: "missions.c6_unifi.mailTicketBody",
    });
    fx.chat("itsupport", "soriya", fx.t("missions.c6_unifi.chatSoriya1"));
    fx.notify({
      severity: "high",
      source: "SOC",
      titleKey: "missions.c6_unifi.mailTicketSubject",
      kind: "soc",
      linkMission: "c6_unifi",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c6_unifi.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c6_unifi.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c6_unifi.t1", hintKey: "missions.c6_unifi.h1" },
        { id: "t2", labelKey: "missions.c6_unifi.t2", hintKey: "missions.c6_unifi.h2" },
        { id: "t3", labelKey: "missions.c6_unifi.t3", hintKey: "missions.c6_unifi.h3" },
        { id: "t4", labelKey: "missions.c6_unifi.t4", hintKey: "missions.c6_unifi.h4" },
        { id: "t5", labelKey: "missions.c6_unifi.t5", hintKey: "missions.c6_unifi.h5" },
        { id: "t6", labelKey: "missions.c6_unifi.t6", hintKey: "missions.c6_unifi.h6" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c6u_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c6u_call",
            kind: "call",
            speaker: "soriya",
            contextKey: "missions.c6_unifi.callContext",
            questionKey: "missions.c6_unifi.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c6_unifi.callA",
                correct: true,
                consequenceKey: "missions.c6_unifi.callConsequenceA",
                whyKey: "missions.c6_unifi.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.c6_unifi.callB",
                consequenceKey: "missions.c6_unifi.callConsequenceB",
                whyKey: "missions.c6_unifi.callConsequenceB",
                rep: -4,
              },
            ],
          });
        }
        if (onHost(e, "GW-UDM") && (cmd(e, "info") || cmd(e, "show") || cmd(e, "help"))) done.push("t2");
        if (onHost(e, "GW-UDM") && cmd(e, "show") && argvHas(e, "firewall")) done.push("t3");
        if (state.world.hosts["GW-UDM"]?.guestIsolation !== false && !hasRule(state, GUEST_LAN_ID)) {
          done.push("t4");
        }
        if (!guestLeaks(state) && dnsOkFromOffice(state)) done.push("t5");
        if (e.type === "chat-sent" && e.channel === "itsupport" && !guestLeaks(state) && dnsOkFromOffice(state)) {
          done.push("t6");
        }
        if (
          (done.includes("t2") || mission.tasks.t2?.done) &&
          mission.decisions["c6u_call"] &&
          !mission.decisions["c6u_marc"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c6u_marc",
            kind: "decision",
            contextKey: "missions.c6_unifi.decisionContext",
            questionKey: "missions.c6_unifi.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c6_unifi.decA",
                consequenceKey: "missions.c6_unifi.decConsequenceA",
                whyKey: "missions.c6_unifi.learningWhy",
                rep: -6,
                fx: (fxx, s) => {
                  const rt = s.missions["c6_unifi"];
                  if (rt && !rt.errorKeys.includes("left_guest_open")) {
                    rt.errors += 1;
                    rt.errorKeys.push("left_guest_open");
                  }
                  fxx.setLearning({
                    titleKey: "missions.c6_unifi.learningTitle",
                    impactKey: "missions.c6_unifi.learningImpact",
                    whyKey: "missions.c6_unifi.learningWhy",
                    checkKey: "missions.c6_unifi.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.c6_unifi.decB",
                correct: true,
                consequenceKey: "missions.c6_unifi.decConsequenceB",
                whyKey: "missions.c6_unifi.decConsequenceB",
                rep: 5,
              },
            ],
          });
        }
        const complete =
          !guestLeaks(state) &&
          dnsOkFromOffice(state) &&
          (e.type === "chat-sent" && e.channel === "itsupport");
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.skill("unifi", "practice", 25);
        fx.skill("vlan", "practice", 10);
        fx.chat("itsupport", "lena", fx.t("missions.c6_unifi.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "c6_unifi",
      titleKey: "missions.c6_unifi.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "unifi", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.c6_unifi.method",
      nextStepKey: "missions.c6_unifi.next",
      report: t("missions.c6_unifi.title") + ` — ${score}/100`,
    };
  },
};

export const c6_sim: MissionDef = {
  id: "c6_sim",
  chapter: 6,
  kind: "simulation",
  skillIds: ["pfsense", "mikrotik", "unifi", "firewall"],
  prereq: ["c6_unifi"],
  difficulty: 3,
  hasVariants: true,
  variants: ["pf", "route", "guest"],
  estimateMin: 14,
  titleKey: "missions.c6_sim.title",
  briefKey: "missions.c6_sim.brief",
  onStart: (fx, _state, variant) => {
    restoreMikrotik(fx);
    restoreUdm(fx);
    fx.setWorld((w) => {
      stripRule(w, PF_HOLE_ID);
      stripRule(w, GUEST_LAN_ID);
    });
    if (variant === "pf") {
      fx.setWorld((w) => upsertRule(w, pfHoleRule()));
    } else if (variant === "route") {
      breakMikrotik(fx);
    } else {
      fx.mutateHost("GW-UDM", (h) => {
        h.guestIsolation = false;
      });
      fx.setWorld((w) => upsertRule(w, guestLanRule()));
    }
    fx.mail({
      from: "lena",
      subjectKey: "missions.c6_sim.mailSubject",
      bodyKey: "missions.c6_sim.mailBody",
    });
    fx.chat("itsupport", "lena", fx.t("missions.c6_sim.chatLena1"));
    fx.notify({
      severity: "high",
      source: "Academy",
      titleKey: "missions.c6_sim.mailSubject",
      kind: "system",
      linkMission: "c6_sim",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c6_sim.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c6_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.c6_sim.t1", hintKey: "missions.c6_sim.h1" },
        { id: "t2", labelKey: "missions.c6_sim.t2", hintKey: "missions.c6_sim.h2" },
        { id: "t3", labelKey: "missions.c6_sim.t3", hintKey: "missions.c6_sim.h3" },
        { id: "t4", labelKey: "missions.c6_sim.t4", hintKey: "missions.c6_sim.h4" },
        { id: "t5", labelKey: "missions.c6_sim.t5", hintKey: "missions.c6_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const v = mission.variant;
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c6s_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c6s_call",
            kind: "call",
            speaker: "lena",
            contextKey: "missions.c6_sim.callContext",
            questionKey: "missions.c6_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c6_sim.callA",
                correct: true,
                consequenceKey: "missions.c6_sim.callConsequenceA",
                whyKey: "missions.c6_sim.callConsequenceA",
                rep: 3,
              },
              {
                id: "B",
                labelKey: "missions.c6_sim.callB",
                consequenceKey: "missions.c6_sim.callConsequenceB",
                whyKey: "missions.c6_sim.callConsequenceB",
                rep: -2,
              },
              {
                id: "C",
                labelKey: "missions.c6_sim.callC",
                consequenceKey: "missions.c6_sim.callConsequenceC",
                whyKey: "missions.c6_sim.callConsequenceC",
                rep: -5,
              },
            ],
          });
        }
        if (e.type === "cmd") done.push("t2");
        const pfOk = !hasRule(state, PF_HOLE_ID) && financeClosed(state) && dnsOkFromOffice(state);
        const routeOk = branchIntranetOk(state);
        const guestOk = !guestLeaks(state) && dnsOkFromOffice(state);
        if (v === "pf" && pfOk) done.push("t3", "t4");
        if (v === "route" && routeOk) done.push("t3", "t4");
        if (v === "guest" && guestOk) done.push("t3", "t4");
        const ok = (v === "pf" && pfOk) || (v === "route" && routeOk) || (v === "guest" && guestOk);
        if (e.type === "chat-sent" && e.channel === "itsupport" && ok) done.push("t5");
        const complete = !!ok && e.type === "chat-sent" && e.channel === "itsupport";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(150);
        fx.skill("pfsense", "practice", 10);
        fx.skill("mikrotik", "practice", 10);
        fx.skill("unifi", "practice", 10);
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    const v = mission.variant;
    return {
      missionId: "c6_sim",
      titleKey: "missions.c6_sim.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "pfsense", level: "practice" },
        { id: "mikrotik", level: "practice" },
        { id: "unifi", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c6_sim.method",
      nextStepKey: "missions.c6_sim.next",
      report: [
        t("missions.c6_sim.reportSubject"),
        `Cause: ${t(`missions.c6_sim.cause_${v}`)}`,
        `${score}/100`,
      ].join("\n"),
    };
  },
};
