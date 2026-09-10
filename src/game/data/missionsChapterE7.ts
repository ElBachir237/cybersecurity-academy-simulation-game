// Chapter 9 — SOC L2: sandbox hash/strings, isolate host, IOC watchlist
import type { DebriefData, MissionDef } from "../types";
import {
  EDR_ALERT_ID,
  EDR_HOST,
  SAMPLE_HASH,
  clearHostIsolation,
  hostIsolated,
  injectBeaconLogs,
  iocListed,
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

function triedRunSample(e: { type: string; argv?: string[] }): boolean {
  if (e.type !== "cmd") return false;
  const argv = e.argv ?? [];
  const joined = argv.join(" ").toLowerCase();
  if (!joined.includes("sample.quarantine")) return false;
  const c = (argv[0] ?? "").toLowerCase().replace(/^\.\//, "");
  return !["sha256sum", "strings", "cat", "ls", "head", "tail", "file", "less", "more"].includes(c);
}

export const e7_lab: MissionDef = {
  id: "e7_lab",
  chapter: 9,
  kind: "lab",
  skillIds: ["malware_triage", "log_analysis", "ioc"],
  prereq: ["e6_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.e7_lab.title",
  briefKey: "missions.e7_lab.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => {
      seedEdrQueue(w, state.timeMin);
      injectBeaconLogs(w);
      clearHostIsolation(w, EDR_HOST);
      w.iocs = [];
    });
    fx.chat("soc", "soriya", fx.t("missions.e7_lab.chatSoriya1"));
    fx.notify({
      severity: "high",
      source: "EDR HORIZON",
      titleKey: "socAlerts.edr.title",
      bodyKey: "socAlerts.edr.body",
      kind: "soc",
      linkMission: "e7_lab",
    });
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e7_lab.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e7_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e7_lab.t1", hintKey: "missions.e7_lab.h1" },
        { id: "t2", labelKey: "missions.e7_lab.t2", hintKey: "missions.e7_lab.h2" },
        { id: "t3", labelKey: "missions.e7_lab.t3", hintKey: "missions.e7_lab.h3" },
        { id: "t4", labelKey: "missions.e7_lab.t4", hintKey: "missions.e7_lab.h4" },
        { id: "t5", labelKey: "missions.e7_lab.t5", hintKey: "missions.e7_lab.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && e.app === "soc") done.push("t1");
        if (e.type === "cmd" || (e.type === "action" && e.action?.startsWith("soc-"))) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e7_run"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e7_run",
            kind: "decision",
            contextKey: "missions.e7_lab.decisionContext",
            questionKey: "missions.e7_lab.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e7_lab.decA",
                consequenceKey: "missions.e7_lab.decConsequenceA",
                whyKey: "missions.e7_lab.learningWhy",
                rep: -8,
                fx: (fxx, s) => {
                  const rt = s.missions["e7_lab"];
                  if (rt) markError(rt, "run_sample");
                  fxx.setLearning({
                    titleKey: "missions.e7_lab.learningTitle",
                    impactKey: "missions.e7_lab.learningImpact",
                    whyKey: "missions.e7_lab.learningWhy",
                    checkKey: "missions.e7_lab.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.e7_lab.decB",
                correct: true,
                consequenceKey: "missions.e7_lab.decConsequenceB",
                whyKey: "missions.e7_lab.decConsequenceB",
                rep: 6,
              },
            ],
          });
        }
        if (triedRunSample(e)) markError(mission, "run_sample");
        if (cmd(e, "sha256sum") && (argvHas(e, "sample") || argvHas(e, SAMPLE_HASH.slice(0, 8))))
          done.push("t2");
        if (cmd(e, "strings") && argvHas(e, "sample")) done.push("t3");
        if (hostIsolated(state, EDR_HOST)) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "soc" && hostIsolated(state, EDR_HOST)) done.push("t5");
        const complete =
          (mission.tasks.t2?.done || done.includes("t2")) &&
          (mission.tasks.t3?.done || done.includes("t3")) &&
          hostIsolated(state, EDR_HOST) &&
          e.type === "chat-sent" &&
          e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.awardBadge("sandbox_analyst");
        fx.skill("malware_triage", "practice", 20);
        fx.skill("ioc", "learning", 10);
        fx.chat("soc", "soriya", fx.t("missions.e7_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => ({
    missionId: "e7_lab",
    titleKey: "missions.e7_lab.title",
    outcome: mission.errors ? "partial" : "success",
    score: scoreOf(mission),
    maxScore: 100,
    errors: [],
    skillsValidated: [{ id: "malware_triage", level: "practice" }],
    skillsToReview: [],
    methodKey: "missions.e7_lab.method",
    nextStepKey: "missions.e7_lab.next",
    report: t("missions.e7_lab.title") + ` — ${scoreOf(mission)}/100`,
  }),
};

export const e7_ioc: MissionDef = {
  id: "e7_ioc",
  chapter: 9,
  kind: "mission",
  skillIds: ["ioc", "threat_hunting", "log_analysis"],
  prereq: ["e7_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 12,
  titleKey: "missions.e7_ioc.title",
  briefKey: "missions.e7_ioc.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => {
      seedEdrQueue(w, state.timeMin);
      injectBeaconLogs(w);
      w.iocs = [];
    });
    fx.mail({
      from: "soriya",
      subjectKey: "missions.e7_ioc.mailSubject",
      bodyKey: "missions.e7_ioc.mailBody",
    });
    fx.chat("soc", "soriya", fx.t("missions.e7_ioc.chatSoriya1"));
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e7_ioc.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e7_ioc.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e7_ioc.t1", hintKey: "missions.e7_ioc.h1" },
        { id: "t2", labelKey: "missions.e7_ioc.t2", hintKey: "missions.e7_ioc.h2" },
        { id: "t3", labelKey: "missions.e7_ioc.t3", hintKey: "missions.e7_ioc.h3" },
        { id: "t4", labelKey: "missions.e7_ioc.t4", hintKey: "missions.e7_ioc.h4" },
        { id: "t5", labelKey: "missions.e7_ioc.t5", hintKey: "missions.e7_ioc.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e7i_leak"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e7i_leak",
            kind: "call",
            speaker: "soriya",
            contextKey: "missions.e7_ioc.callContext",
            questionKey: "missions.e7_ioc.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e7_ioc.callA",
                correct: true,
                consequenceKey: "missions.e7_ioc.callConsequenceA",
                whyKey: "missions.e7_ioc.callConsequenceA",
                rep: 5,
              },
              {
                id: "B",
                labelKey: "missions.e7_ioc.callB",
                consequenceKey: "missions.e7_ioc.callConsequenceB",
                whyKey: "missions.e7_ioc.learningWhy",
                rep: -6,
                fx: (fxx, s) => {
                  const rt = s.missions["e7_ioc"];
                  if (rt) markError(rt, "leak_ioc");
                  fxx.setLearning({
                    titleKey: "missions.e7_ioc.learningTitle",
                    impactKey: "missions.e7_ioc.learningImpact",
                    whyKey: "missions.e7_ioc.learningWhy",
                    checkKey: "missions.e7_ioc.learningCheck",
                  });
                },
              },
            ],
          });
        }
        if (e.type === "chat-sent" && e.channel === "general" && (e.text ?? "").toLowerCase().includes("a4f3")) {
          markError(mission, "leak_ioc");
        }
        if (
          (cmd(e, "grep") || cmd(e, "journalctl") || cmd(e, "cat")) &&
          (e.hostId === EDR_HOST || argvHas(e, "beacon") || argvHas(e, "203.0.113"))
        )
          done.push("t2");
        if (cmd(e, "ioc") && argvHas(e, "add") && argvHas(e, SAMPLE_HASH.slice(0, 8))) done.push("t3");
        if (iocListed(state)) done.push("t3", "t4");
        if (e.type === "action" && e.action === "soc-escalate" && e.payload?.id === EDR_ALERT_ID) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "soc" && iocListed(state)) done.push("t5");
        const complete = iocListed(state) && e.type === "chat-sent" && e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(120);
        fx.skill("ioc", "practice", 20);
        fx.skill("threat_hunting", "practice", 10);
        fx.chat("soc", "soriya", fx.t("missions.e7_ioc.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => ({
    missionId: "e7_ioc",
    titleKey: "missions.e7_ioc.title",
    outcome: mission.errors ? "partial" : "success",
    score: scoreOf(mission),
    maxScore: 100,
    errors: [],
    skillsValidated: [{ id: "ioc", level: "practice" }],
    skillsToReview: [],
    methodKey: "missions.e7_ioc.method",
    nextStepKey: "missions.e7_ioc.next",
    report: t("missions.e7_ioc.title") + ` — ${scoreOf(mission)}/100`,
  }),
};

export const e7_sim: MissionDef = {
  id: "e7_sim",
  chapter: 9,
  kind: "simulation",
  skillIds: ["malware_triage", "ioc", "threat_hunting"],
  prereq: ["e7_ioc"],
  difficulty: 3,
  hasVariants: true,
  variants: ["hash", "isolate", "ioc"],
  estimateMin: 14,
  titleKey: "missions.e7_sim.title",
  briefKey: "missions.e7_sim.brief",
  onStart: (fx, state, variant) => {
    fx.setWorld((w) => {
      seedEdrQueue(w, state.timeMin);
      injectBeaconLogs(w);
      w.iocs = [];
      clearHostIsolation(w, EDR_HOST);
      if (variant === "isolate") clearHostIsolation(w, EDR_HOST);
    });
    fx.mail({
      from: "soriya",
      subjectKey: "missions.e7_sim.mailSubject",
      bodyKey: "missions.e7_sim.mailBody",
    });
    fx.chat("soc", "soriya", fx.t("missions.e7_sim.chatSoriya1"));
  },
  steps: [
    { id: "brief", type: "brief", enter: (fx) => fx.objective("missions.e7_sim.obj1") },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e7_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.e7_sim.t1", hintKey: "missions.e7_sim.h1" },
        { id: "t2", labelKey: "missions.e7_sim.t2", hintKey: "missions.e7_sim.h2" },
        { id: "t3", labelKey: "missions.e7_sim.t3", hintKey: "missions.e7_sim.h3" },
        { id: "t4", labelKey: "missions.e7_sim.t4", hintKey: "missions.e7_sim.h4" },
        { id: "t5", labelKey: "missions.e7_sim.t5", hintKey: "missions.e7_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const v = mission.variant;
        if (e.type === "mail-read" || (e.type === "app-opened" && e.app === "soc")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e7x_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e7x_call",
            kind: "call",
            speaker: "soriya",
            contextKey: "missions.e7_sim.callContext",
            questionKey: "missions.e7_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e7_sim.callA",
                correct: true,
                consequenceKey: "missions.e7_sim.callConsequenceA",
                whyKey: "missions.e7_sim.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.e7_sim.callB",
                consequenceKey: "missions.e7_sim.callConsequenceB",
                whyKey: "missions.e7_sim.callConsequenceB",
                rep: -3,
              },
              {
                id: "C",
                labelKey: "missions.e7_sim.callC",
                consequenceKey: "missions.e7_sim.callConsequenceC",
                whyKey: "missions.e7_sim.callConsequenceC",
                rep: -8,
                fx: (_fxx, s) => {
                  const rt = s.missions["e7_sim"];
                  if (rt) markError(rt, "run_sample");
                },
              },
            ],
          });
        }
        if (triedRunSample(e)) markError(mission, "run_sample");
        if (e.type === "cmd") done.push("t2");
        let triaged = false;
        if (v === "hash") triaged = cmd(e, "sha256sum") || mission.tasks.t3?.done;
        if (v === "hash" && cmd(e, "sha256sum")) {
          done.push("t3", "t4");
          triaged = true;
        }
        if (v === "isolate") {
          triaged = hostIsolated(state, EDR_HOST);
          if (triaged) done.push("t3", "t4");
        }
        if (v === "ioc") {
          triaged = iocListed(state);
          if (triaged) done.push("t3", "t4");
        }
        if (e.type === "chat-sent" && e.channel === "soc" && (triaged || mission.tasks.t4?.done))
          done.push("t5");
        const complete =
          (v === "hash" ? mission.tasks.t3?.done || cmd(e, "sha256sum") : triaged) &&
          e.type === "chat-sent" &&
          e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(150);
        fx.skill("malware_triage", "practice", 15);
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    const v = mission.variant;
    return {
      missionId: "e7_sim",
      titleKey: "missions.e7_sim.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "malware_triage", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e7_sim.method",
      nextStepKey: "missions.e7_sim.next",
      report: [
        t("missions.e7_sim.reportSubject"),
        `Cause: ${t(`missions.e7_sim.cause_${v}`)}`,
        `${score}/100`,
      ].join("\n"),
    };
  },
};
