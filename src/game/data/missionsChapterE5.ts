// Chapter 7 — Architecture workshop palier 1: place, cable, address, publish
import type { DebriefData, GameState, MissionDef } from "../types";
import { ipReachable } from "../terminal";
import {
  LAB_FW,
  LAB_GW_IP,
  LAB_PC,
  LAB_PC_IP,
  LAB_SITE,
  LAB_SW,
  LAB_WEB,
  LAB_WEB_IP,
  applyLabAddressing,
  clearWorkshop,
  ensureBuiltRack,
  hasLink,
  labSiteReachable,
  rackPlaced,
  requiredCablesPresent,
  stripLabAddressing,
  uncableWorkshop,
} from "./workshop";

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

export const e5_lab: MissionDef = {
  id: "e5_lab",
  chapter: 7,
  kind: "lab",
  skillIds: ["seg_arch", "pfsense", "switching"],
  prereq: ["c6_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.e5_lab.title",
  briefKey: "missions.e5_lab.brief",
  onStart: (fx) => {
    fx.setWorld((w) => clearWorkshop(w));
    fx.objective("missions.e5_lab.obj1");
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("missions.e5_lab.obj1");
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.missionReady",
          kind: "system",
          linkMission: "e5_lab",
        });
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e5_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e5_lab.t1", hintKey: "missions.e5_lab.h1" },
        { id: "t2", labelKey: "missions.e5_lab.t2", hintKey: "missions.e5_lab.h2" },
        { id: "t3", labelKey: "missions.e5_lab.t3", hintKey: "missions.e5_lab.h3" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && e.app === "network") done.push("t1");
        if (e.type === "action" && e.action?.startsWith("workshop-")) done.push("t1");
        if (rackPlaced(state)) done.push("t2");
        if (requiredCablesPresent(state)) done.push("t3");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e5_skip"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e5_skip",
            kind: "decision",
            contextKey: "missions.e5_lab.decisionContext",
            questionKey: "missions.e5_lab.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e5_lab.decA",
                consequenceKey: "missions.e5_lab.decConsequenceA",
                whyKey: "missions.e5_lab.learningWhy",
                rep: -5,
                fx: (fxx, s) => {
                  const rt = s.missions["e5_lab"];
                  if (rt && !rt.errorKeys.includes("skip_switch")) {
                    rt.errors += 1;
                    rt.errorKeys.push("skip_switch");
                  }
                  fxx.setLearning({
                    titleKey: "missions.e5_lab.learningTitle",
                    impactKey: "missions.e5_lab.learningImpact",
                    whyKey: "missions.e5_lab.learningWhy",
                    checkKey: "missions.e5_lab.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.e5_lab.decB",
                correct: true,
                consequenceKey: "missions.e5_lab.decConsequenceB",
                whyKey: "missions.e5_lab.decConsequenceB",
                rep: 4,
              },
            ],
          });
        }
        const complete = rackPlaced(state) && requiredCablesPresent(state);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(120);
        fx.awardBadge("rack_builder");
        fx.skill("seg_arch", "practice", 20);
        fx.chat("itsupport", "lena", fx.t("missions.e5_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "e5_lab",
      titleKey: "missions.e5_lab.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "seg_arch", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e5_lab.method",
      nextStepKey: "missions.e5_lab.next",
      report: t("missions.e5_lab.title") + ` — ${score}/100`,
    };
  },
};

export const e5_site: MissionDef = {
  id: "e5_site",
  chapter: 7,
  kind: "mission",
  skillIds: ["web_hosting", "dns", "pfsense"],
  prereq: ["e5_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.e5_site.title",
  briefKey: "missions.e5_site.brief",
  onStart: (fx, state) => {
    fx.setWorld((w) => {
      ensureBuiltRack(w);
      stripLabAddressing(w);
      const vhosts = w.vhosts ?? {};
      if (vhosts[LAB_SITE]) vhosts[LAB_SITE] = { ...vhosts[LAB_SITE], enabled: false };
      const dns = { ...(w.dns ?? {}) };
      delete dns[LAB_SITE];
      w.dns = dns;
      w.tickets = w.tickets.filter((t) => t.id !== "IT-7101");
      w.tickets.push({
        id: "IT-7101",
        severity: "medium",
        titleKey: "missions.e5_site.mailTicketSubject",
        from: "Lena Kovac (IT)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: LAB_WEB,
      });
    });
    fx.mail({
      from: "lena",
      subjectKey: "missions.e5_site.mailTicketSubject",
      bodyKey: "missions.e5_site.mailTicketBody",
    });
    fx.chat("itsupport", "lena", fx.t("missions.e5_site.chatLena1"));
    fx.notify({
      severity: "high",
      source: "IT Service Desk",
      titleKey: "missions.e5_site.mailTicketSubject",
      kind: "it",
      linkMission: "e5_site",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.e5_site.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e5_site.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.e5_site.t1", hintKey: "missions.e5_site.h1" },
        { id: "t2", labelKey: "missions.e5_site.t2", hintKey: "missions.e5_site.h2" },
        { id: "t3", labelKey: "missions.e5_site.t3", hintKey: "missions.e5_site.h3" },
        { id: "t4", labelKey: "missions.e5_site.t4", hintKey: "missions.e5_site.h4" },
        { id: "t5", labelKey: "missions.e5_site.t5", hintKey: "missions.e5_site.h5" },
        { id: "t6", labelKey: "missions.e5_site.t6", hintKey: "missions.e5_site.h6" },
        { id: "t7", labelKey: "missions.e5_site.t7", hintKey: "missions.e5_site.h7" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e5s_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e5s_call",
            kind: "call",
            speaker: "lena",
            contextKey: "missions.e5_site.callContext",
            questionKey: "missions.e5_site.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e5_site.callA",
                correct: true,
                consequenceKey: "missions.e5_site.callConsequenceA",
                whyKey: "missions.e5_site.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.e5_site.callB",
                consequenceKey: "missions.e5_site.callConsequenceB",
                whyKey: "missions.e5_site.callConsequenceB",
                rep: -4,
              },
            ],
          });
        }
        const fw = state.world.hosts[LAB_FW];
        const web = state.world.hosts[LAB_WEB];
        const pc = state.world.hosts[LAB_PC];
        if (fw?.ifaces.em1?.ip === LAB_GW_IP) done.push("t2");
        if (onHost(e, LAB_FW) && (cmd(e, "ifconfig") || cmd(e, "set")) && argvHas(e, LAB_GW_IP)) done.push("t2");
        if (web?.ifaces.eth0?.ip === LAB_WEB_IP) done.push("t3");
        if (pc?.ifaces.eth0?.ip === LAB_PC_IP) done.push("t4");
        if (state.world.dns?.[LAB_SITE] === LAB_WEB_IP) done.push("t5");
        if (state.world.vhosts?.[LAB_SITE]?.enabled) done.push("t6");
        if (pc && ipReachable(LAB_WEB_IP, pc, state) && labSiteReachable(state)) done.push("t6", "t7");
        if (e.type === "chat-sent" && e.channel === "itsupport" && labSiteReachable(state)) done.push("t7");
        if (
          (done.includes("t2") || mission.tasks.t2?.done) &&
          mission.decisions["e5s_call"] &&
          !mission.decisions["e5s_dns"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e5s_dns",
            kind: "decision",
            contextKey: "missions.e5_site.decisionContext",
            questionKey: "missions.e5_site.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e5_site.decA",
                consequenceKey: "missions.e5_site.decConsequenceA",
                whyKey: "missions.e5_site.learningWhy",
                rep: -5,
                fx: (fxx, s) => {
                  const rt = s.missions["e5_site"];
                  if (rt && !rt.errorKeys.includes("skip_dns")) {
                    rt.errors += 1;
                    rt.errorKeys.push("skip_dns");
                  }
                  fxx.setLearning({
                    titleKey: "missions.e5_site.learningTitle",
                    impactKey: "missions.e5_site.learningImpact",
                    whyKey: "missions.e5_site.learningWhy",
                    checkKey: "missions.e5_site.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.e5_site.decB",
                correct: true,
                consequenceKey: "missions.e5_site.decConsequenceB",
                whyKey: "missions.e5_site.decConsequenceB",
                rep: 5,
              },
            ],
          });
        }
        const complete =
          labSiteReachable(state) && e.type === "chat-sent" && e.channel === "itsupport";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.skill("web_hosting", "practice", 20);
        fx.skill("dns", "practice", 10);
        fx.chat("itsupport", "lena", fx.t("missions.e5_site.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "e5_site",
      titleKey: "missions.e5_site.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "web_hosting", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e5_site.method",
      nextStepKey: "missions.e5_site.next",
      report: t("missions.e5_site.title") + ` — ${score}/100`,
    };
  },
};

export const e5_sim: MissionDef = {
  id: "e5_sim",
  chapter: 7,
  kind: "simulation",
  skillIds: ["seg_arch", "web_hosting", "pfsense"],
  prereq: ["e5_site"],
  difficulty: 3,
  hasVariants: true,
  variants: ["cable", "addr", "nginx"],
  estimateMin: 14,
  titleKey: "missions.e5_sim.title",
  briefKey: "missions.e5_sim.brief",
  onStart: (fx, _state, variant) => {
    fx.setWorld((w) => {
      ensureBuiltRack(w);
      applyLabAddressing(w);
      const vhosts = w.vhosts ?? {};
      if (vhosts[LAB_SITE]) vhosts[LAB_SITE] = { ...vhosts[LAB_SITE], enabled: true };
      w.dns = { ...(w.dns ?? {}), [LAB_SITE]: LAB_WEB_IP };
      const web = w.hosts[LAB_WEB];
      if (web) web.services.nginx = "active";
      if (variant === "cable") uncableWorkshop(w, LAB_SW, LAB_WEB);
      if (variant === "addr" && web?.ifaces.eth0) web.ifaces.eth0 = { state: "up", dhcp: false };
      if (variant === "nginx" && web) web.services.nginx = "failed";
    });
    fx.mail({
      from: "lena",
      subjectKey: "missions.e5_sim.mailSubject",
      bodyKey: "missions.e5_sim.mailBody",
    });
    fx.chat("itsupport", "lena", fx.t("missions.e5_sim.chatLena1"));
    fx.notify({
      severity: "high",
      source: "Academy",
      titleKey: "missions.e5_sim.mailSubject",
      kind: "system",
      linkMission: "e5_sim",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.e5_sim.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.e5_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.e5_sim.t1", hintKey: "missions.e5_sim.h1" },
        { id: "t2", labelKey: "missions.e5_sim.t2", hintKey: "missions.e5_sim.h2" },
        { id: "t3", labelKey: "missions.e5_sim.t3", hintKey: "missions.e5_sim.h3" },
        { id: "t4", labelKey: "missions.e5_sim.t4", hintKey: "missions.e5_sim.h4" },
        { id: "t5", labelKey: "missions.e5_sim.t5", hintKey: "missions.e5_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const v = mission.variant;
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["e5x_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "e5x_call",
            kind: "call",
            speaker: "lena",
            contextKey: "missions.e5_sim.callContext",
            questionKey: "missions.e5_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.e5_sim.callA",
                correct: true,
                consequenceKey: "missions.e5_sim.callConsequenceA",
                whyKey: "missions.e5_sim.callConsequenceA",
                rep: 3,
              },
              {
                id: "B",
                labelKey: "missions.e5_sim.callB",
                consequenceKey: "missions.e5_sim.callConsequenceB",
                whyKey: "missions.e5_sim.callConsequenceB",
                rep: -2,
              },
              {
                id: "C",
                labelKey: "missions.e5_sim.callC",
                consequenceKey: "missions.e5_sim.callConsequenceC",
                whyKey: "missions.e5_sim.callConsequenceC",
                rep: -5,
              },
            ],
          });
        }
        if (e.type === "cmd" || e.type === "action") done.push("t2");
        const ws = state.world.workshop ?? { nodes: [], links: [] };
        const cableOk = hasLink(ws, LAB_SW, LAB_WEB);
        const addrOk = state.world.hosts[LAB_WEB]?.ifaces.eth0?.ip === LAB_WEB_IP;
        const nginxOk = state.world.hosts[LAB_WEB]?.services.nginx === "active";
        const siteOk = labSiteReachable(state);
        if (v === "cable" && cableOk) done.push("t3", "t4");
        if (v === "addr" && addrOk) done.push("t3", "t4");
        if (v === "nginx" && nginxOk) done.push("t3", "t4");
        if (siteOk) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "itsupport" && siteOk) done.push("t5");
        const complete = siteOk && e.type === "chat-sent" && e.channel === "itsupport";
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(150);
        fx.skill("seg_arch", "practice", 15);
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    const v = mission.variant;
    return {
      missionId: "e5_sim",
      titleKey: "missions.e5_sim.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "seg_arch", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.e5_sim.method",
      nextStepKey: "missions.e5_sim.next",
      report: [
        t("missions.e5_sim.reportSubject"),
        `Cause: ${t(`missions.e5_sim.cause_${v}`)}`,
        `${score}/100`,
      ].join("\n"),
    };
  },
};
