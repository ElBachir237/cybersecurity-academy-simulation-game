// Chapter 10 — Incident response: contain the host, keep payroll alive
import type { DebriefData, GameState, MissionDef } from "../types";
import {
  EDR_HOST,
  IR_PAY_ID,
  clearHostIsolation,
  financeAlive,
  hostIsolated,
  injectBeaconLogs,
  injectPayrollBlock,
  payrollBlocked,
  seedEdrQueue,
} from "./defend";

function scoreOf(mission: { errors: number; hintsUsed: number }): number {
  return Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
}

const cmd = (e: { type: string; argv?: string[] }, name: string) =>
  e.type === "cmd" && (e.argv?.[0] ?? "").replace(/^\//, "").toLowerCase() === name.toLowerCase();

const argvHas = (e: { argv?: string[] }, ...needles: string[]) => {
  const argv = (e.argv ?? []).map((a) => a.toLowerCase());
  return needles.every((n) => argv.some((a) => a.includes(n.toLowerCase())));
};

function markError(mission: { errors: number; errorKeys: string[] }, key: string): void {
  if (mission.errorKeys.includes(key)) return;
  mission.errors += 1;
  mission.errorKeys.push(key);
}

function marieWorks(state: GameState): boolean {
  return financeAlive(state);
}

export const e8_lab: MissionDef = {
  id: "e8_lab",
  chapter: 10,
  kind: "lab",
  skillIds: ["incident_response", "defense_depth"],
  prereq: ["e7_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.e8_lab.title",
  briefKey: "missions.e8_lab.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => {
      seedEdrQueue(w, state.timeMin);
      injectBeaconLogs(w);
      clearHostIsolation(w, EDR_HOST);
      w.fwRules = (w.fwRules ?? []).filter((r) => r.id !== IR_PAY_ID);
    });
    fx.chat("soc", "soriya", fx.t("missions.e8_lab.chatSoriya1"));
    fx.notify({
      severity: "critical",
      source: "SOC",
      titleKey: "missions.e8_lab.queueTitle",
      kind: "soc",
      linkMission: "e8_lab",
    });
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e8_lab.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e8_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e8_lab.t1", hintKey: "missions.e8_lab.h1" },
        { id: "t2", labelKey: "missions.e8_lab.t2", hintKey: "missions.e8_lab.h2" },
        { id: "t3", labelKey: "missions.e8_lab.t3", hintKey: "missions.e8_lab.h3" },
        { id: "t4", labelKey: "missions.e8_lab.t4", hintKey: "missions.e8_lab.h4" },
        { id: "t5", labelKey: "missions.e8_lab.t5", hintKey: "missions.e8_lab.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && (e.app === "soc" || e.app === "terminal")) done.push("t1");
        if (e.type === "cmd") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e8_cut"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e8_cut",
            kind: "decision",
            contextKey: "missions.e8_lab.decisionContext",
            questionKey: "missions.e8_lab.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e8_lab.decA",
                consequenceKey: "missions.e8_lab.decConsequenceA",
                whyKey: "missions.e8_lab.learningWhy",
                rep: -8,
                fx: (fxx, s) => {
                  const rt = s.missions["e8_lab"];
                  if (rt) markError(rt, "kill_payroll");
                  injectPayrollBlock(s.world);
                  fxx.setLearning({
                    titleKey: "missions.e8_lab.learningTitle",
                    impactKey: "missions.e8_lab.learningImpact",
                    whyKey: "missions.e8_lab.learningWhy",
                    checkKey: "missions.e8_lab.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.e8_lab.decB",
                correct: true,
                consequenceKey: "missions.e8_lab.decConsequenceB",
                whyKey: "missions.e8_lab.decConsequenceB",
                rep: 6,
              },
            ],
          });
        }
        if (cmd(e, "iptables") && argvHas(e, "drop") && argvHas(e, "192.168.20")) {
          markError(mission, "kill_payroll");
        }
        if (hostIsolated(state, EDR_HOST)) done.push("t2", "t3");
        const marieOk = marieWorks(state);
        if (marieOk && hostIsolated(state, EDR_HOST)) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "soc" && hostIsolated(state, EDR_HOST) && marieOk)
          done.push("t5");
        const complete =
          hostIsolated(state, EDR_HOST) &&
          marieOk &&
          e.type === "chat-sent" &&
          e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(140);
        fx.awardBadge("incident_responder");
        fx.skill("incident_response", "practice", 20);
        fx.skill("defense_depth", "practice", 10);
        fx.chat("soc", "soriya", fx.t("missions.e8_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => ({
    missionId: "e8_lab",
    titleKey: "missions.e8_lab.title",
    outcome: mission.errors ? "partial" : "success",
    score: scoreOf(mission),
    maxScore: 100,
    errors: [],
    skillsValidated: [{ id: "incident_response", level: "practice" }],
    skillsToReview: [],
    methodKey: "missions.e8_lab.method",
    nextStepKey: "missions.e8_lab.next",
    report: t("missions.e8_lab.title") + ` — ${scoreOf(mission)}/100`,
  }),
};

export const e8_ir: MissionDef = {
  id: "e8_ir",
  chapter: 10,
  kind: "mission",
  skillIds: ["incident_response", "log_analysis"],
  prereq: ["e8_lab"],
  difficulty: 3,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.e8_ir.title",
  briefKey: "missions.e8_ir.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => {
      seedEdrQueue(w, state.timeMin);
      injectBeaconLogs(w);
      clearHostIsolation(w, EDR_HOST);
      w.fwRules = (w.fwRules ?? []).filter((r) => r.id !== IR_PAY_ID);
    });
    fx.mail({
      from: "soriya",
      subjectKey: "missions.e8_ir.mailSubject",
      bodyKey: "missions.e8_ir.mailBody",
    });
    fx.chat("soc", "soriya", fx.t("missions.e8_ir.chatSoriya1"));
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e8_ir.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e8_ir.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e8_ir.t1", hintKey: "missions.e8_ir.h1" },
        { id: "t2", labelKey: "missions.e8_ir.t2", hintKey: "missions.e8_ir.h2" },
        { id: "t3", labelKey: "missions.e8_ir.t3", hintKey: "missions.e8_ir.h3" },
        { id: "t4", labelKey: "missions.e8_ir.t4", hintKey: "missions.e8_ir.h4" },
        { id: "t5", labelKey: "missions.e8_ir.t5", hintKey: "missions.e8_ir.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e8c_marc"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e8c_marc",
            kind: "call",
            speaker: "marc",
            contextKey: "missions.e8_ir.callContext",
            questionKey: "missions.e8_ir.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e8_ir.callA",
                correct: true,
                consequenceKey: "missions.e8_ir.callConsequenceA",
                whyKey: "missions.e8_ir.callConsequenceA",
                rep: 6,
              },
              {
                id: "B",
                labelKey: "missions.e8_ir.callB",
                consequenceKey: "missions.e8_ir.callConsequenceB",
                whyKey: "missions.e8_ir.learningWhy",
                rep: -7,
                fx: (fxx, s) => {
                  const rt = s.missions["e8_ir"];
                  if (rt) markError(rt, "all_clear");
                  fxx.setLearning({
                    titleKey: "missions.e8_ir.learningTitle",
                    impactKey: "missions.e8_ir.learningImpact",
                    whyKey: "missions.e8_ir.learningWhy",
                    checkKey: "missions.e8_ir.learningCheck",
                  });
                },
              },
              {
                id: "C",
                labelKey: "missions.e8_ir.callC",
                consequenceKey: "missions.e8_ir.callConsequenceC",
                whyKey: "missions.e8_ir.callConsequenceC",
                rep: -8,
                fx: (_fxx, s) => {
                  const rt = s.missions["e8_ir"];
                  if (rt) markError(rt, "kill_payroll");
                  injectPayrollBlock(s.world);
                },
              },
            ],
          });
        }
        if (e.type === "chat-sent" && e.channel === "general") markError(mission, "all_clear");
        if (
          (cmd(e, "grep") || cmd(e, "journalctl") || cmd(e, "cat")) &&
          e.hostId === EDR_HOST
        )
          done.push("t2");
        if (hostIsolated(state, EDR_HOST)) done.push("t3");
        if (marieWorks(state) && hostIsolated(state, EDR_HOST)) done.push("t4");
        if (
          e.type === "chat-sent" &&
          e.channel === "soc" &&
          hostIsolated(state, EDR_HOST) &&
          marieWorks(state)
        )
          done.push("t5");
        const complete =
          hostIsolated(state, EDR_HOST) &&
          marieWorks(state) &&
          e.type === "chat-sent" &&
          e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(140);
        fx.skill("incident_response", "practice", 15);
        fx.chat("soc", "soriya", fx.t("missions.e8_ir.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => ({
    missionId: "e8_ir",
    titleKey: "missions.e8_ir.title",
    outcome: mission.errors ? "partial" : "success",
    score: scoreOf(mission),
    maxScore: 100,
    errors: [],
    skillsValidated: [{ id: "incident_response", level: "practice" }],
    skillsToReview: [],
    methodKey: "missions.e8_ir.method",
    nextStepKey: "missions.e8_ir.next",
    report: t("missions.e8_ir.title") + ` — ${scoreOf(mission)}/100`,
  }),
};

export const e8_sim: MissionDef = {
  id: "e8_sim",
  chapter: 10,
  kind: "simulation",
  skillIds: ["incident_response", "defense_depth"],
  prereq: ["e8_ir"],
  difficulty: 3,
  hasVariants: true,
  variants: ["isolate", "payroll", "comms"],
  estimateMin: 14,
  titleKey: "missions.e8_sim.title",
  briefKey: "missions.e8_sim.brief",
  onStart: (fx, state, variant) => {
    fx.setWorld((w) => {
      seedEdrQueue(w, state.timeMin);
      injectBeaconLogs(w);
      clearHostIsolation(w, EDR_HOST);
      w.fwRules = (w.fwRules ?? []).filter((r) => r.id !== IR_PAY_ID);
      if (variant === "payroll") injectPayrollBlock(w);
      if (variant === "isolate") clearHostIsolation(w, EDR_HOST);
    });
    fx.mail({
      from: "soriya",
      subjectKey: "missions.e8_sim.mailSubject",
      bodyKey: "missions.e8_sim.mailBody",
    });
    fx.chat("soc", "soriya", fx.t("missions.e8_sim.chatSoriya1"));
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e8_sim.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e8_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.e8_sim.t1", hintKey: "missions.e8_sim.h1" },
        { id: "t2", labelKey: "missions.e8_sim.t2", hintKey: "missions.e8_sim.h2" },
        { id: "t3", labelKey: "missions.e8_sim.t3", hintKey: "missions.e8_sim.h3" },
        { id: "t4", labelKey: "missions.e8_sim.t4", hintKey: "missions.e8_sim.h4" },
        { id: "t5", labelKey: "missions.e8_sim.t5", hintKey: "missions.e8_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const v = mission.variant;
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e8x_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e8x_call",
            kind: "call",
            speaker: "soriya",
            contextKey: "missions.e8_sim.callContext",
            questionKey: "missions.e8_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e8_sim.callA",
                correct: true,
                consequenceKey: "missions.e8_sim.callConsequenceA",
                whyKey: "missions.e8_sim.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.e8_sim.callB",
                consequenceKey: "missions.e8_sim.callConsequenceB",
                whyKey: "missions.e8_sim.callConsequenceB",
                rep: -3,
              },
              {
                id: "C",
                labelKey: "missions.e8_sim.callC",
                consequenceKey: "missions.e8_sim.callConsequenceC",
                whyKey: "missions.e8_sim.callConsequenceC",
                rep: -7,
                fx: (_fxx, s) => {
                  const rt = s.missions["e8_sim"];
                  if (rt) markError(rt, v === "comms" ? "all_clear" : "kill_payroll");
                },
              },
            ],
          });
        }
        if (e.type === "chat-sent" && e.channel === "general") markError(mission, "all_clear");
        if (e.type === "cmd" || e.type === "action") done.push("t2");
        let ok = false;
        if (v === "isolate") ok = hostIsolated(state, EDR_HOST) && marieWorks(state);
        if (v === "payroll") ok = !payrollBlocked(state) && marieWorks(state);
        if (v === "comms") ok = hostIsolated(state, EDR_HOST) && marieWorks(state);
        if (ok) done.push("t3", "t4");
        if (e.type === "chat-sent" && e.channel === "soc" && ok) done.push("t5");
        const complete = ok && e.type === "chat-sent" && e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(160);
        fx.skill("incident_response", "practice", 15);
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    const v = mission.variant;
    return {
      missionId: "e8_sim",
      titleKey: "missions.e8_sim.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "incident_response", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e8_sim.method",
      nextStepKey: "missions.e8_sim.next",
      report: [
        t("missions.e8_sim.reportSubject"),
        `Cause: ${t(`missions.e8_sim.cause_${v}`)}`,
        `${score}/100`,
      ].join("\n"),
    };
  },
};
