// Chapter 11 — DFIR: timeline, acquire the contained host, scope the blast radius
import type { DebriefData, MissionDef } from "../types";
import { EDR_HOST, seedEdrQueue } from "./defend";
import {
  clearEvidence,
  injectForensicLogs,
  overscope,
  paulAcquired,
  triedWipe,
} from "./dfir";

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

function readTimeline(e: { type: string; argv?: string[]; hostId?: string }): boolean {
  if (e.type !== "cmd") return false;
  if (cmd(e, "cat") || cmd(e, "less") || cmd(e, "more") || cmd(e, "head") || cmd(e, "tail")) {
    return argvHas(e, "timeline") || argvHas(e, "paul.auth") || argvHas(e, "evidence");
  }
  if (cmd(e, "grep") || cmd(e, "journalctl")) {
    return (
      argvHas(e, "horiz0n") ||
      argvHas(e, "initial") ||
      argvHas(e, "14:58") ||
      argvHas(e, "beacon") ||
      argvHas(e, "203.0.113") ||
      e.hostId === EDR_HOST
    );
  }
  return false;
}

function seedDfirWorld(state: { timeMin: number }, world: Parameters<typeof injectForensicLogs>[0]): void {
  seedEdrQueue(world, state.timeMin);
  injectForensicLogs(world);
  clearEvidence(world);
  const paul = world.hosts[EDR_HOST];
  if (paul) paul.isolated = true;
}

export const e9_lab: MissionDef = {
  id: "e9_lab",
  chapter: 11,
  kind: "lab",
  skillIds: ["forensics", "timeline", "log_analysis"],
  prereq: ["e8_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.e9_lab.title",
  briefKey: "missions.e9_lab.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => seedDfirWorld(state, w));
    fx.chat("soc", "soriya", fx.t("missions.e9_lab.chatSoriya1"));
    fx.notify({
      severity: "high",
      source: "DFIR HORIZON",
      titleKey: "missions.e9_lab.queueTitle",
      kind: "soc",
      linkMission: "e9_lab",
    });
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e9_lab.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e9_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e9_lab.t1", hintKey: "missions.e9_lab.h1" },
        { id: "t2", labelKey: "missions.e9_lab.t2", hintKey: "missions.e9_lab.h2" },
        { id: "t3", labelKey: "missions.e9_lab.t3", hintKey: "missions.e9_lab.h3" },
        { id: "t4", labelKey: "missions.e9_lab.t4", hintKey: "missions.e9_lab.h4" },
        { id: "t5", labelKey: "missions.e9_lab.t5", hintKey: "missions.e9_lab.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && (e.app === "soc" || e.app === "terminal")) done.push("t1");
        if (e.type === "cmd") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e9_wipe"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e9_wipe",
            kind: "decision",
            contextKey: "missions.e9_lab.decisionContext",
            questionKey: "missions.e9_lab.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e9_lab.decA",
                consequenceKey: "missions.e9_lab.decConsequenceA",
                whyKey: "missions.e9_lab.learningWhy",
                rep: -8,
                fx: (fxx, s) => {
                  const rt = s.missions["e9_lab"];
                  if (rt) markError(rt, "wipe_disk");
                  fxx.setLearning({
                    titleKey: "missions.e9_lab.learningTitle",
                    impactKey: "missions.e9_lab.learningImpact",
                    whyKey: "missions.e9_lab.learningWhy",
                    checkKey: "missions.e9_lab.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.e9_lab.decB",
                correct: true,
                consequenceKey: "missions.e9_lab.decConsequenceB",
                whyKey: "missions.e9_lab.decConsequenceB",
                rep: 6,
              },
            ],
          });
        }
        if (triedWipe(e)) markError(mission, "wipe_disk");
        if (cmd(e, "acquire") && (argvHas(e, "marie") || argvHas(e, "comp") || argvHas(e, "srv-web"))) {
          markError(mission, "image_payroll");
        }
        if (paulAcquired(state)) done.push("t2");
        if (readTimeline(e) || mission.tasks.t3?.done) done.push("t3");
        if ((readTimeline(e) && paulAcquired(state)) || mission.tasks.t4?.done) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "soc" && paulAcquired(state)) done.push("t5");
        const complete =
          paulAcquired(state) &&
          (mission.tasks.t3?.done || readTimeline(e)) &&
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
        fx.awardBadge("dfir_scribe");
        fx.skill("forensics", "practice", 20);
        fx.skill("timeline", "learning", 10);
        fx.chat("soc", "soriya", fx.t("missions.e9_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => ({
    missionId: "e9_lab",
    titleKey: "missions.e9_lab.title",
    outcome: mission.errors ? "partial" : "success",
    score: scoreOf(mission),
    maxScore: 100,
    errors: [],
    skillsValidated: [{ id: "forensics", level: "practice" }],
    skillsToReview: [],
    methodKey: "missions.e9_lab.method",
    nextStepKey: "missions.e9_lab.next",
    report: t("missions.e9_lab.title") + ` — ${scoreOf(mission)}/100`,
  }),
};

export const e9_scope: MissionDef = {
  id: "e9_scope",
  chapter: 11,
  kind: "mission",
  skillIds: ["forensics", "timeline", "ioc"],
  prereq: ["e9_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.e9_scope.title",
  briefKey: "missions.e9_scope.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => seedDfirWorld(state, w));
    fx.mail({
      from: "soriya",
      subjectKey: "missions.e9_scope.mailSubject",
      bodyKey: "missions.e9_scope.mailBody",
    });
    fx.chat("soc", "soriya", fx.t("missions.e9_scope.chatSoriya1"));
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e9_scope.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e9_scope.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e9_scope.t1", hintKey: "missions.e9_scope.h1" },
        { id: "t2", labelKey: "missions.e9_scope.t2", hintKey: "missions.e9_scope.h2" },
        { id: "t3", labelKey: "missions.e9_scope.t3", hintKey: "missions.e9_scope.h3" },
        { id: "t4", labelKey: "missions.e9_scope.t4", hintKey: "missions.e9_scope.h4" },
        { id: "t5", labelKey: "missions.e9_scope.t5", hintKey: "missions.e9_scope.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e9s_dump"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e9s_dump",
            kind: "call",
            speaker: "soriya",
            contextKey: "missions.e9_scope.callContext",
            questionKey: "missions.e9_scope.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e9_scope.callA",
                correct: true,
                consequenceKey: "missions.e9_scope.callConsequenceA",
                whyKey: "missions.e9_scope.callConsequenceA",
                rep: 5,
              },
              {
                id: "B",
                labelKey: "missions.e9_scope.callB",
                consequenceKey: "missions.e9_scope.callConsequenceB",
                whyKey: "missions.e9_scope.learningWhy",
                rep: -7,
                fx: (fxx, s) => {
                  const rt = s.missions["e9_scope"];
                  if (rt) markError(rt, "leak_pii");
                  fxx.setLearning({
                    titleKey: "missions.e9_scope.learningTitle",
                    impactKey: "missions.e9_scope.learningImpact",
                    whyKey: "missions.e9_scope.learningWhy",
                    checkKey: "missions.e9_scope.learningCheck",
                  });
                },
              },
            ],
          });
        }
        if (e.type === "chat-sent" && e.channel === "general") markError(mission, "leak_pii");
        if (cmd(e, "acquire") && (argvHas(e, "marie") || argvHas(e, "comp") || argvHas(e, "srv-web"))) {
          markError(mission, "image_payroll");
        }
        if (triedWipe(e)) markError(mission, "wipe_disk");
        if (readTimeline(e)) done.push("t2");
        if (paulAcquired(state)) done.push("t3");
        if (paulAcquired(state) && !overscope(state)) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "soc" && paulAcquired(state)) done.push("t5");
        const complete =
          paulAcquired(state) && e.type === "chat-sent" && e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.skill("timeline", "practice", 20);
        fx.skill("forensics", "practice", 10);
        fx.chat("soc", "soriya", fx.t("missions.e9_scope.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => ({
    missionId: "e9_scope",
    titleKey: "missions.e9_scope.title",
    outcome: mission.errors ? "partial" : "success",
    score: scoreOf(mission),
    maxScore: 100,
    errors: [],
    skillsValidated: [{ id: "timeline", level: "practice" }],
    skillsToReview: [],
    methodKey: "missions.e9_scope.method",
    nextStepKey: "missions.e9_scope.next",
    report: t("missions.e9_scope.title") + ` — ${scoreOf(mission)}/100`,
  }),
};

export const e9_sim: MissionDef = {
  id: "e9_sim",
  chapter: 11,
  kind: "simulation",
  skillIds: ["forensics", "timeline", "ioc"],
  prereq: ["e9_scope"],
  difficulty: 3,
  hasVariants: true,
  variants: ["auth", "scope", "hash"],
  estimateMin: 14,
  titleKey: "missions.e9_sim.title",
  briefKey: "missions.e9_sim.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => seedDfirWorld(state, w));
    fx.mail({
      from: "soriya",
      subjectKey: "missions.e9_sim.mailSubject",
      bodyKey: "missions.e9_sim.mailBody",
    });
    fx.chat("soc", "soriya", fx.t("missions.e9_sim.chatSoriya1"));
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e9_sim.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e9_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.e9_sim.t1", hintKey: "missions.e9_sim.h1" },
        { id: "t2", labelKey: "missions.e9_sim.t2", hintKey: "missions.e9_sim.h2" },
        { id: "t3", labelKey: "missions.e9_sim.t3", hintKey: "missions.e9_sim.h3" },
        { id: "t4", labelKey: "missions.e9_sim.t4", hintKey: "missions.e9_sim.h4" },
        { id: "t5", labelKey: "missions.e9_sim.t5", hintKey: "missions.e9_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const v = mission.variant;
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e9x_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e9x_call",
            kind: "call",
            speaker: "soriya",
            contextKey: "missions.e9_sim.callContext",
            questionKey: "missions.e9_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e9_sim.callA",
                correct: true,
                consequenceKey: "missions.e9_sim.callConsequenceA",
                whyKey: "missions.e9_sim.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.e9_sim.callB",
                consequenceKey: "missions.e9_sim.callConsequenceB",
                whyKey: "missions.e9_sim.callConsequenceB",
                rep: -3,
              },
              {
                id: "C",
                labelKey: "missions.e9_sim.callC",
                consequenceKey: "missions.e9_sim.callConsequenceC",
                whyKey: "missions.e9_sim.callConsequenceC",
                rep: -8,
                fx: (_fxx, s) => {
                  const rt = s.missions["e9_sim"];
                  if (rt) markError(rt, v === "scope" ? "image_payroll" : "wipe_disk");
                },
              },
            ],
          });
        }
        if (triedWipe(e)) markError(mission, "wipe_disk");
        if (e.type === "chat-sent" && e.channel === "general") markError(mission, "leak_pii");
        if (e.type === "cmd") done.push("t2");
        let ok = false;
        if (v === "auth") {
          const found = readTimeline(e) || mission.tasks.t3?.done;
          if (found) done.push("t3", "t4");
          ok = !!(mission.tasks.t3?.done || found);
        }
        if (v === "scope") {
          if (cmd(e, "acquire") && (argvHas(e, "marie") || argvHas(e, "comp"))) {
            markError(mission, "image_payroll");
          }
          ok = paulAcquired(state);
          if (ok) done.push("t3", "t4");
        }
        if (v === "hash") {
          const hashed =
            cmd(e, "sha256sum") &&
            (argvHas(e, "timeline") || argvHas(e, "evidence") || argvHas(e, "paul.auth"));
          if (hashed && paulAcquired(state)) done.push("t3", "t4");
          ok = paulAcquired(state) && !!(mission.tasks.t3?.done || hashed);
        }
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
        fx.skill("forensics", "practice", 15);
        fx.skill("timeline", "practice", 15);
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    const v = mission.variant;
    return {
      missionId: "e9_sim",
      titleKey: "missions.e9_sim.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "forensics", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e9_sim.method",
      nextStepKey: "missions.e9_sim.next",
      report: [
        t("missions.e9_sim.reportSubject"),
        `Cause: ${t(`missions.e9_sim.cause_${v}`)}`,
        `${score}/100`,
      ].join("\n"),
    };
  },
};
