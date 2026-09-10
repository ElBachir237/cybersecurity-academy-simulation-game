// Chapter 8 — SOC L1: triage SIEM, logs, phishing (défense uniquement)
import type { DebriefData, MissionDef } from "../types";
import {
  BRUTE_ALERT_ID,
  BRUTE_HOST,
  PHISH_ALERT_ID,
  allAlertsHandled,
  injectBruteLogs,
  noiseClosedAsFp,
  phishMailReported,
  seedBruteQueue,
  seedNoiseQueue,
  seedPhishQueue,
  truePositiveEscalated,
} from "./soc";

function scoreOf(mission: { errors: number; hintsUsed: number }): number {
  return Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
}

const cmd = (e: { type: string; argv?: string[] }, name: string) =>
  e.type === "cmd" && (e.argv?.[0] ?? "").replace(/^\//, "").toLowerCase() === name.toLowerCase();

const onHost = (e: { type: string; hostId?: string }, host: string) =>
  e.type === "cmd" && e.hostId === host;

const argvHas = (e: { argv?: string[] }, ...needles: string[]) => {
  const argv = (e.argv ?? []).map((a) => a.toLowerCase());
  return needles.every((n) => argv.some((a) => a.includes(n.toLowerCase())));
};

function inspectedBruteLogs(e: { type: string; hostId?: string; argv?: string[] }): boolean {
  if (!onHost(e, BRUTE_HOST)) return false;
  if (cmd(e, "journalctl") && argvHas(e, "sshd")) return true;
  if ((cmd(e, "grep") || cmd(e, "cat") || cmd(e, "tail")) && argvHas(e, "failed")) return true;
  if ((cmd(e, "grep") || cmd(e, "cat") || cmd(e, "tail") || cmd(e, "journalctl")) && argvHas(e, "auth"))
    return true;
  if (cmd(e, "journalctl") && argvHas(e, "ssh")) return true;
  return false;
}

function markError(
  mission: { errors: number; errorKeys: string[] },
  key: string
): void {
  if (mission.errorKeys.includes(key)) return;
  mission.errors += 1;
  mission.errorKeys.push(key);
}

export const e6_lab: MissionDef = {
  id: "e6_lab",
  chapter: 8,
  kind: "lab",
  skillIds: ["alert_triage", "siem", "log_analysis"],
  prereq: ["e5_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.e6_lab.title",
  briefKey: "missions.e6_lab.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => {
      seedBruteQueue(w, state.timeMin);
      injectBruteLogs(w);
    });
    fx.chat("soc", "soriya", fx.t("missions.e6_lab.chatSoriya1"));
    fx.notify({
      severity: "high",
      source: "SIEM HORIZON",
      titleKey: "missions.e6_lab.queueTitle",
      bodyKey: "missions.e6_lab.queueBody",
      kind: "soc",
      linkMission: "e6_lab",
    });
    fx.objective("missions.e6_lab.obj1");
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.e6_lab.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e6_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e6_lab.t1", hintKey: "missions.e6_lab.h1" },
        { id: "t2", labelKey: "missions.e6_lab.t2", hintKey: "missions.e6_lab.h2" },
        { id: "t3", labelKey: "missions.e6_lab.t3", hintKey: "missions.e6_lab.h3" },
        { id: "t4", labelKey: "missions.e6_lab.t4", hintKey: "missions.e6_lab.h4" },
        { id: "t5", labelKey: "missions.e6_lab.t5", hintKey: "missions.e6_lab.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && e.app === "soc") done.push("t1");
        if (e.type === "action" && e.action?.startsWith("soc-")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e6_dump"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e6_dump",
            kind: "decision",
            contextKey: "missions.e6_lab.decisionContext",
            questionKey: "missions.e6_lab.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e6_lab.decA",
                consequenceKey: "missions.e6_lab.decConsequenceA",
                whyKey: "missions.e6_lab.learningWhy",
                rep: -6,
                fx: (fxx, s) => {
                  const rt = s.missions["e6_lab"];
                  if (rt) markError(rt, "flood_soriya");
                  fxx.setLearning({
                    titleKey: "missions.e6_lab.learningTitle",
                    impactKey: "missions.e6_lab.learningImpact",
                    whyKey: "missions.e6_lab.learningWhy",
                    checkKey: "missions.e6_lab.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.e6_lab.decB",
                correct: true,
                consequenceKey: "missions.e6_lab.decConsequenceB",
                whyKey: "missions.e6_lab.decConsequenceB",
                rep: 5,
              },
            ],
          });
        }
        if (e.type === "action" && e.action === "soc-fp" && e.payload?.id === BRUTE_ALERT_ID) {
          markError(mission, "missed_tp");
        }
        if (e.type === "action" && e.action === "soc-escalate") {
          const id = String(e.payload?.id ?? "");
          if (id && id !== BRUTE_ALERT_ID) markError(mission, "flood_soriya");
        }
        if (noiseClosedAsFp(state)) done.push("t2");
        if (inspectedBruteLogs(e) || mission.tasks.t3?.done) done.push("t3");
        if (truePositiveEscalated(state, BRUTE_ALERT_ID)) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "soc" && truePositiveEscalated(state, BRUTE_ALERT_ID)) {
          done.push("t5");
        }
        const complete =
          noiseClosedAsFp(state) &&
          truePositiveEscalated(state, BRUTE_ALERT_ID) &&
          (mission.tasks.t3?.done || inspectedBruteLogs(e)) &&
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
        fx.awardBadge("soc_triage");
        fx.skill("alert_triage", "practice", 20);
        fx.skill("siem", "learning", 10);
        fx.chat("soc", "soriya", fx.t("missions.e6_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "e6_lab",
      titleKey: "missions.e6_lab.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "alert_triage", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e6_lab.method",
      nextStepKey: "missions.e6_lab.next",
      report: t("missions.e6_lab.title") + ` — ${score}/100`,
    };
  },
};

export const e6_phish: MissionDef = {
  id: "e6_phish",
  chapter: 8,
  kind: "mission",
  skillIds: ["alert_triage", "sec_fundamentals"],
  prereq: ["e6_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 12,
  titleKey: "missions.e6_phish.title",
  briefKey: "missions.e6_phish.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => {
      seedPhishQueue(w, state.timeMin);
      w.tickets = w.tickets.filter((t) => t.id !== "SOC-8101");
      w.tickets.push({
        id: "SOC-8101",
        severity: "medium",
        titleKey: "missions.e6_phish.mailSubject",
        from: "Soriya Chan (SOC)",
        status: "open",
        createdAt: state.timeMin,
      });
    });
    fx.mail({
      from: "it-security@horiz0n.corp",
      subjectKey: "missions.e6_phish.mailSubject",
      bodyKey: "missions.e6_phish.mailBody",
      phish: true,
    });
    fx.chat("soc", "soriya", fx.t("missions.e6_phish.chatSoriya1"));
    fx.notify({
      severity: "medium",
      source: "SIEM HORIZON",
      titleKey: "socAlerts.phish.title",
      bodyKey: "socAlerts.phish.body",
      kind: "soc",
      linkMission: "e6_phish",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.e6_phish.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e6_phish.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e6_phish.t1", hintKey: "missions.e6_phish.h1" },
        { id: "t2", labelKey: "missions.e6_phish.t2", hintKey: "missions.e6_phish.h2" },
        { id: "t3", labelKey: "missions.e6_phish.t3", hintKey: "missions.e6_phish.h3" },
        { id: "t4", labelKey: "missions.e6_phish.t4", hintKey: "missions.e6_phish.h4" },
        { id: "t5", labelKey: "missions.e6_phish.t5", hintKey: "missions.e6_phish.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e6p_click"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e6p_click",
            kind: "decision",
            contextKey: "missions.e6_phish.callContext",
            questionKey: "missions.e6_phish.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e6_phish.callA",
                correct: true,
                consequenceKey: "missions.e6_phish.callConsequenceA",
                whyKey: "missions.e6_phish.callConsequenceA",
                rep: 6,
              },
              {
                id: "B",
                labelKey: "missions.e6_phish.callB",
                consequenceKey: "missions.e6_phish.callConsequenceB",
                whyKey: "missions.e6_phish.learningWhy",
                rep: -8,
                fx: (fxx, s) => {
                  const rt = s.missions["e6_phish"];
                  if (rt) markError(rt, "phish_click");
                  fxx.setLearning({
                    titleKey: "missions.e6_phish.learningTitle",
                    impactKey: "missions.e6_phish.learningImpact",
                    whyKey: "missions.e6_phish.learningWhy",
                    checkKey: "missions.e6_phish.learningCheck",
                  });
                },
              },
              {
                id: "C",
                labelKey: "missions.e6_phish.callC",
                consequenceKey: "missions.e6_phish.callConsequenceC",
                whyKey: "missions.e6_phish.callConsequenceC",
                rep: -3,
              },
            ],
          });
        }
        if (mission.decisions["e6p_click"] === "A") done.push("t2");
        if (e.type === "action" && e.action === "mail-report-phish") done.push("t2", "t3");
        if (phishMailReported(state)) done.push("t3");
        if (truePositiveEscalated(state, PHISH_ALERT_ID)) done.push("t4");
        const phishHandled = phishMailReported(state) || truePositiveEscalated(state, PHISH_ALERT_ID);
        if (e.type === "chat-sent" && e.channel === "soc" && phishHandled) done.push("t5");
        const complete = phishHandled && e.type === "chat-sent" && e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(120);
        fx.skill("alert_triage", "practice", 15);
        fx.skill("sec_fundamentals", "practice", 10);
        fx.chat("soc", "soriya", fx.t("missions.e6_phish.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "e6_phish",
      titleKey: "missions.e6_phish.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "alert_triage", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e6_phish.method",
      nextStepKey: "missions.e6_phish.next",
      report: t("missions.e6_phish.title") + ` — ${score}/100`,
    };
  },
};

export const e6_sim: MissionDef = {
  id: "e6_sim",
  chapter: 8,
  kind: "simulation",
  skillIds: ["alert_triage", "siem", "log_analysis"],
  prereq: ["e6_phish"],
  difficulty: 3,
  hasVariants: true,
  variants: ["noise", "brute", "phish"],
  estimateMin: 14,
  titleKey: "missions.e6_sim.title",
  briefKey: "missions.e6_sim.brief",
  onStart: (fx, state, variant) => {
    fx.setWorld((w) => {
      if (variant === "noise") seedNoiseQueue(w, state.timeMin);
      else if (variant === "phish") seedPhishQueue(w, state.timeMin);
      else {
        seedBruteQueue(w, state.timeMin);
        injectBruteLogs(w);
      }
    });
    if (variant === "phish") {
      fx.mail({
        from: "it-security@horiz0n.corp",
        subjectKey: "missions.e6_phish.mailSubject",
        bodyKey: "missions.e6_phish.mailBody",
        phish: true,
      });
    } else {
      fx.mail({
        from: "soriya",
        subjectKey: "missions.e6_sim.mailSubject",
        bodyKey: "missions.e6_sim.mailBody",
      });
    }
    fx.chat("soc", "soriya", fx.t("missions.e6_sim.chatSoriya1"));
    fx.notify({
      severity: "high",
      source: "Academy",
      titleKey: "missions.e6_sim.mailSubject",
      kind: "soc",
      linkMission: "e6_sim",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.e6_sim.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e6_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.e6_sim.t1", hintKey: "missions.e6_sim.h1" },
        { id: "t2", labelKey: "missions.e6_sim.t2", hintKey: "missions.e6_sim.h2" },
        { id: "t3", labelKey: "missions.e6_sim.t3", hintKey: "missions.e6_sim.h3" },
        { id: "t4", labelKey: "missions.e6_sim.t4", hintKey: "missions.e6_sim.h4" },
        { id: "t5", labelKey: "missions.e6_sim.t5", hintKey: "missions.e6_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const v = mission.variant;
        if (e.type === "mail-read" || (e.type === "app-opened" && e.app === "soc")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e6x_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e6x_call",
            kind: "call",
            speaker: "soriya",
            contextKey: "missions.e6_sim.callContext",
            questionKey: "missions.e6_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e6_sim.callA",
                correct: true,
                consequenceKey: "missions.e6_sim.callConsequenceA",
                whyKey: "missions.e6_sim.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.e6_sim.callB",
                consequenceKey: "missions.e6_sim.callConsequenceB",
                whyKey: "missions.e6_sim.callConsequenceB",
                rep: -3,
              },
              {
                id: "C",
                labelKey: "missions.e6_sim.callC",
                consequenceKey: "missions.e6_sim.callConsequenceC",
                whyKey: "missions.e6_sim.callConsequenceC",
                rep: -6,
                fx: (_fxx, s) => {
                  const rt = s.missions["e6_sim"];
                  if (!rt) return;
                  markError(rt, rt.variant === "phish" ? "phish_click" : "flood_soriya");
                },
              },
            ],
          });
        }
        if (v === "brute" && inspectedBruteLogs(e)) done.push("t2");
        if (v !== "brute" && (e.type === "cmd" || (e.type === "action" && e.action?.startsWith("soc-")))) {
          done.push("t2");
        }
        if (e.type === "action" && e.action === "soc-escalate") {
          const id = String(e.payload?.id ?? "");
          if (v === "noise" && id) markError(mission, "flood_soriya");
          if (v === "brute" && id && id !== BRUTE_ALERT_ID) markError(mission, "flood_soriya");
        }
        if (e.type === "action" && e.action === "soc-fp" && e.payload?.id === BRUTE_ALERT_ID && v === "brute") {
          markError(mission, "missed_tp");
        }
        let triaged = false;
        if (v === "noise") triaged = allAlertsHandled(state);
        if (v === "brute") {
          triaged =
            truePositiveEscalated(state, BRUTE_ALERT_ID) &&
            (mission.tasks.t2?.done || inspectedBruteLogs(e));
        }
        if (v === "phish") {
          triaged = phishMailReported(state) || truePositiveEscalated(state, PHISH_ALERT_ID);
        }
        if (triaged) done.push("t3", "t4");
        if (e.type === "chat-sent" && e.channel === "soc" && triaged) done.push("t5");
        const complete = triaged && e.type === "chat-sent" && e.channel === "soc";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(150);
        fx.skill("alert_triage", "practice", 15);
        fx.skill("log_analysis", "practice", 10);
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    const v = mission.variant;
    return {
      missionId: "e6_sim",
      titleKey: "missions.e6_sim.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "alert_triage", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e6_sim.method",
      nextStepKey: "missions.e6_sim.next",
      report: [
        t("missions.e6_sim.reportSubject"),
        `Cause: ${t(`missions.e6_sim.cause_${v}`)}`,
        `${score}/100`,
      ].join("\n"),
    };
  },
};
