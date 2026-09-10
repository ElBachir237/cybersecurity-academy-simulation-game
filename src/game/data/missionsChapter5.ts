// Chapter 5 — Systems, nginx vhosts, simulated AD
import type { DebriefData, GameState, MissionDef } from "../types";
import { resolveName } from "../terminal";
import { httpSite, seedDirectory, seedVhosts } from "./world";

const RH = "rh.horizon.local";
const RH_IP = "10.0.0.20";

const cmd = (e: { type: string; argv?: string[] }, name: string) =>
  e.type === "cmd" && (e.argv?.[0] ?? "").toLowerCase() === name;

const onHost = (e: { type: string; hostId?: string }, host: string) =>
  e.type === "cmd" && e.hostId === host;

const argvHas = (e: { argv?: string[] }, ...needles: string[]) => {
  const argv = (e.argv ?? []).map((a) => a.toLowerCase());
  return needles.every((n) => argv.some((a) => a.includes(n.toLowerCase())));
};

function siteOk(hostId: string, name: string, state: GameState): boolean {
  const h = state.world.hosts[hostId];
  if (!h) return false;
  const ip = resolveName(name, h, state);
  if (!ip) return false;
  const page = httpSite(name, state);
  return !!page && page.status === 200;
}

function nginxUp(state: GameState): boolean {
  return state.world.hosts["SRV-WEB"]?.services.nginx === "active";
}

function rhLive(state: GameState): boolean {
  return siteOk("WS-001", RH, state);
}

function userReady(state: GameState, sam: string): boolean {
  const u = state.world.directory?.[sam];
  return !!u && u.enabled && !u.locked;
}

function scoreOf(mission: { errors: number; hintsUsed: number }): number {
  return Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
}

function restoreIntranet(fx: {
  mutateHost: (id: string, fn: (h: GameState["world"]["hosts"][string]) => void) => void;
}) {
  fx.mutateHost("SRV-WEB", (h) => {
    h.services.nginx = "active";
    h.services["php-fpm"] = "active";
  });
  fx.mutateHost("COMP-01", (h) => {
    h.services.smbd = "active";
  });
}

function disableRh(fx: {
  setWorld: (fn: (w: GameState["world"]) => void) => void;
}) {
  fx.setWorld((w) => {
    const seeded = seedVhosts();
    w.vhosts = { ...seeded, ...(w.vhosts ?? {}) };
    w.vhosts[RH] = { ...seeded[RH]!, enabled: false };
    const dns = { ...(w.dns ?? {}) };
    delete dns[RH];
    w.dns = dns;
  });
}

export const c5_lab: MissionDef = {
  id: "c5_lab",
  chapter: 5,
  kind: "lab",
  skillIds: ["linux_admin", "services"],
  prereq: ["c4_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.c5_lab.title",
  briefKey: "missions.c5_lab.brief",
  onStart: (fx) => {
    fx.mutateHost("SRV-WEB", (h) => {
      h.services.nginx = "failed";
      h.logs.push(
        "Sep 12 10:12:01 srv-web nginx[0]: bind() to 0.0.0.0:80 failed",
        "Sep 12 10:12:02 systemd[1]: nginx.service: Failed with result 'exit-code'."
      );
    });
    fx.mutateHost("COMP-01", (h) => {
      h.services.smbd = "active";
    });
    fx.objective("missions.c5_lab.obj1");
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("missions.c5_lab.obj1");
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.missionReady",
          kind: "system",
          linkMission: "c5_lab",
        });
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c5_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c5_lab.t1", hintKey: "missions.c5_lab.h1" },
        { id: "t2", labelKey: "missions.c5_lab.t2", hintKey: "missions.c5_lab.h2" },
        { id: "t3", labelKey: "missions.c5_lab.t3", hintKey: "missions.c5_lab.h3" },
        { id: "t4", labelKey: "missions.c5_lab.t4", hintKey: "missions.c5_lab.h4" },
        { id: "t5", labelKey: "missions.c5_lab.t5", hintKey: "missions.c5_lab.h5" },
        { id: "t6", labelKey: "missions.c5_lab.t6", hintKey: "missions.c5_lab.h6" },
      ],
      handle: ({ state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "app-opened" && e.app === "terminal") done.push("t1");
        if (onHost(e, "SRV-WEB") && (cmd(e, "help") || cmd(e, "hostname"))) done.push("t1");
        if (onHost(e, "SRV-WEB") && cmd(e, "systemctl") && argvHas(e, "status", "nginx")) done.push("t2");
        if (
          onHost(e, "SRV-WEB") &&
          (cmd(e, "journalctl") || cmd(e, "cat") || cmd(e, "tail") || cmd(e, "grep"))
        ) {
          done.push("t3");
        }
        if (
          onHost(e, "SRV-WEB") &&
          cmd(e, "systemctl") &&
          (argvHas(e, "start", "nginx") || argvHas(e, "restart", "nginx")) &&
          nginxUp(state)
        ) {
          done.push("t4");
        }
        if (nginxUp(state)) done.push("t4");
        if (onHost(e, "WS-001") && cmd(e, "curl") && argvHas(e, "intranet.horizon") && siteOk("WS-001", "intranet.horizon", state)) {
          done.push("t5");
        }
        if (siteOk("WS-001", "intranet.horizon", state) && nginxUp(state)) done.push("t5");
        if (onHost(e, "COMP-01") && cmd(e, "systemctl") && argvHas(e, "smbd")) done.push("t6");
        if (state.world.hosts["COMP-01"]?.services.smbd === "active" && nginxUp(state)) done.push("t6");
        const ids = ["t1", "t2", "t3", "t4", "t5", "t6"];
        const complete =
          (done.includes("t5") && done.includes("t4") && (done.includes("t6") || mission.tasks.t6?.done)) ||
          ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(120);
        fx.awardBadge("service_restarter");
        fx.skill("linux_admin", "practice", 20);
        fx.skill("services", "practice", 20);
        fx.chat("itsupport", "lena", fx.t("missions.c5_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "c5_lab",
      titleKey: "missions.c5_lab.title",
      outcome: mission.hintsUsed > 3 ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "linux_admin", level: "practice" },
        { id: "services", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c5_lab.method",
      nextStepKey: "missions.c5_lab.next",
      report: t("missions.c5_lab.title") + ` — ${score}/100`,
    };
  },
};

export const c5_web: MissionDef = {
  id: "c5_web",
  chapter: 5,
  kind: "mission",
  skillIds: ["web_hosting", "dns", "linux_admin"],
  prereq: ["c5_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.c5_web.title",
  briefKey: "missions.c5_web.brief",
  onStart: (fx, state) => {
    restoreIntranet(fx);
    disableRh(fx);
    fx.setWorld((w) => {
      w.tickets = w.tickets.filter((t) => t.id !== "IT-5101");
      w.tickets.push({
        id: "IT-5101",
        severity: "medium",
        titleKey: "missions.c5_web.mailTicketSubject",
        from: "Jules Morel (RH)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: "SRV-WEB",
      });
    });
    fx.mail({
      from: "itsd",
      subjectKey: "missions.c5_web.mailTicketSubject",
      bodyKey: "missions.c5_web.mailTicketBody",
    });
    fx.chat("itsupport", "jules", fx.t("missions.c5_web.chatJules1"));
    fx.notify({
      severity: "high",
      source: "IT Service Desk",
      titleKey: "missions.c5_web.mailTicketSubject",
      kind: "it",
      linkMission: "c5_web",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c5_web.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c5_web.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c5_web.t1", hintKey: "missions.c5_web.h1" },
        { id: "t2", labelKey: "missions.c5_web.t2", hintKey: "missions.c5_web.h2" },
        { id: "t3", labelKey: "missions.c5_web.t3", hintKey: "missions.c5_web.h3" },
        { id: "t4", labelKey: "missions.c5_web.t4", hintKey: "missions.c5_web.h4" },
        { id: "t5", labelKey: "missions.c5_web.t5", hintKey: "missions.c5_web.h5" },
        { id: "t6", labelKey: "missions.c5_web.t6", hintKey: "missions.c5_web.h6" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c5w_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c5w_call",
            kind: "call",
            speaker: "jules",
            contextKey: "missions.c5_web.callContext",
            questionKey: "missions.c5_web.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c5_web.callA",
                correct: true,
                consequenceKey: "missions.c5_web.callConsequenceA",
                whyKey: "missions.c5_web.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.c5_web.callB",
                consequenceKey: "missions.c5_web.callConsequenceB",
                whyKey: "missions.c5_web.callConsequenceB",
                rep: -4,
              },
              {
                id: "C",
                labelKey: "missions.c5_web.callC",
                consequenceKey: "missions.c5_web.callConsequenceC",
                whyKey: "missions.c5_web.callConsequenceC",
                rep: -5,
              },
            ],
          });
        }
        if (
          (cmd(e, "dig") || cmd(e, "nslookup") || cmd(e, "host") || cmd(e, "ping")) &&
          argvHas(e, RH)
        ) {
          done.push("t2");
        }
        if (state.world.dns?.[RH] === RH_IP) done.push("t3");
        if (onHost(e, "DNS-01") && cmd(e, "nsupdate") && argvHas(e, "add", RH) && state.world.dns?.[RH] === RH_IP) {
          done.push("t3");
        }
        if (state.world.vhosts?.[RH]?.enabled) done.push("t4");
        if (onHost(e, "SRV-WEB") && cmd(e, "ln") && argvHas(e, RH)) done.push("t4");
        if (rhLive(state)) done.push("t5");
        if (e.type === "chat-sent" && e.channel === "itsupport" && rhLive(state)) done.push("t6");
        if (
          (done.includes("t2") || mission.tasks.t2?.done) &&
          mission.decisions["c5w_call"] &&
          !mission.decisions["c5w_marc"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c5w_marc",
            kind: "decision",
            contextKey: "missions.c5_web.decisionContext",
            questionKey: "missions.c5_web.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c5_web.decA",
                consequenceKey: "missions.c5_web.decConsequenceA",
                whyKey: "missions.c5_web.learningWhy",
                rep: -6,
                fx: (fxx, s) => {
                  const rt = s.missions["c5_web"];
                  if (rt && !rt.errorKeys.includes("skip_dns")) {
                    rt.errors += 1;
                    rt.errorKeys.push("skip_dns");
                  }
                  fxx.setLearning({
                    titleKey: "missions.c5_web.learningTitle",
                    impactKey: "missions.c5_web.learningImpact",
                    whyKey: "missions.c5_web.learningWhy",
                    checkKey: "missions.c5_web.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.c5_web.decB",
                correct: true,
                consequenceKey: "missions.c5_web.decConsequenceB",
                whyKey: "missions.c5_web.decConsequenceB",
                rep: 5,
              },
            ],
          });
        }
        const ids = ["t1", "t2", "t3", "t4", "t5", "t6"];
        const complete =
          (rhLive(state) && (done.includes("t6") || mission.tasks.t6?.done || (e.type === "chat-sent" && e.channel === "itsupport"))) ||
          ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.awardBadge("web_host");
        fx.skill("web_hosting", "practice", 25);
        fx.skill("dns", "practice", 10);
        fx.chat("itsupport", "lena", fx.t("missions.c5_web.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "c5_web",
      titleKey: "missions.c5_web.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "web_hosting", level: "practice" },
        { id: "dns", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c5_web.method",
      nextStepKey: "missions.c5_web.next",
      report: t("missions.c5_web.title") + ` — ${score}/100`,
    };
  },
};

export const c5_ad: MissionDef = {
  id: "c5_ad",
  chapter: 5,
  kind: "mission",
  skillIds: ["active_directory", "windows_admin", "linux_admin"],
  prereq: ["c5_web"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.c5_ad.title",
  briefKey: "missions.c5_ad.brief",
  onStart: (fx, state) => {
    restoreIntranet(fx);
    fx.setWorld((w) => {
      const dir = { ...seedDirectory(), ...(w.directory ?? {}) };
      delete dir.jmorel;
      w.directory = dir;
      w.tickets = w.tickets.filter((t) => t.id !== "IT-5102");
      w.tickets.push({
        id: "IT-5102",
        severity: "medium",
        titleKey: "missions.c5_ad.mailTicketSubject",
        from: "Jules Morel (RH)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: "SRV-DC",
      });
    });
    fx.mail({
      from: "itsd",
      subjectKey: "missions.c5_ad.mailTicketSubject",
      bodyKey: "missions.c5_ad.mailTicketBody",
    });
    fx.chat("itsupport", "jules", fx.t("missions.c5_ad.chatJules1"));
    fx.notify({
      severity: "high",
      source: "IT Service Desk",
      titleKey: "missions.c5_ad.mailTicketSubject",
      kind: "it",
      linkMission: "c5_ad",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c5_ad.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c5_ad.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c5_ad.t1", hintKey: "missions.c5_ad.h1" },
        { id: "t2", labelKey: "missions.c5_ad.t2", hintKey: "missions.c5_ad.h2" },
        { id: "t3", labelKey: "missions.c5_ad.t3", hintKey: "missions.c5_ad.h3" },
        { id: "t4", labelKey: "missions.c5_ad.t4", hintKey: "missions.c5_ad.h4" },
        { id: "t5", labelKey: "missions.c5_ad.t5", hintKey: "missions.c5_ad.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c5a_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c5a_call",
            kind: "call",
            speaker: "jules",
            contextKey: "missions.c5_ad.callContext",
            questionKey: "missions.c5_ad.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c5_ad.callA",
                correct: true,
                consequenceKey: "missions.c5_ad.callConsequenceA",
                whyKey: "missions.c5_ad.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.c5_ad.callB",
                consequenceKey: "missions.c5_ad.callConsequenceB",
                whyKey: "missions.c5_ad.callConsequenceB",
                rep: -4,
              },
            ],
          });
        }
        if (onHost(e, "SRV-DC") && cmd(e, "samba-tool") && argvHas(e, "user", "list")) done.push("t2");
        if (state.world.directory?.jmorel) done.push("t3");
        if (onHost(e, "SRV-DC") && cmd(e, "samba-tool") && argvHas(e, "user", "create", "jmorel")) done.push("t3");
        if (onHost(e, "SRV-DC") && cmd(e, "samba-tool") && argvHas(e, "user", "show", "jmorel")) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "itsupport" && userReady(state, "jmorel")) done.push("t5");
        if (
          (done.includes("t2") || mission.tasks.t2?.done) &&
          mission.decisions["c5a_call"] &&
          !mission.decisions["c5a_admin"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c5a_admin",
            kind: "decision",
            contextKey: "missions.c5_ad.decisionContext",
            questionKey: "missions.c5_ad.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c5_ad.decA",
                consequenceKey: "missions.c5_ad.decConsequenceA",
                whyKey: "missions.c5_ad.learningWhy",
                rep: -8,
                fx: (fxx, s) => {
                  const rt = s.missions["c5_ad"];
                  if (rt && !rt.errorKeys.includes("domain_admins")) {
                    rt.errors += 1;
                    rt.errorKeys.push("domain_admins");
                  }
                  const u = s.world.directory?.jmorel;
                  if (u && !u.groups.includes("Domain Admins")) u.groups.push("Domain Admins");
                  fxx.setLearning({
                    titleKey: "missions.c5_ad.learningTitle",
                    impactKey: "missions.c5_ad.learningImpact",
                    whyKey: "missions.c5_ad.learningWhy",
                    checkKey: "missions.c5_ad.learningCheck",
                  });
                },
              },
              {
                id: "B",
                labelKey: "missions.c5_ad.decB",
                correct: true,
                consequenceKey: "missions.c5_ad.decConsequenceB",
                whyKey: "missions.c5_ad.decConsequenceB",
                rep: 5,
              },
            ],
          });
        }
        const ids = ["t1", "t2", "t3", "t4", "t5"];
        const complete =
          (userReady(state, "jmorel") &&
            (done.includes("t5") || (e.type === "chat-sent" && e.channel === "itsupport"))) ||
          ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.awardBadge("directory_clerk");
        fx.skill("active_directory", "practice", 25);
        fx.chat("itsupport", "lena", fx.t("missions.c5_ad.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    return {
      missionId: "c5_ad",
      titleKey: "missions.c5_ad.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [{ id: "active_directory", level: "practice" }],
      skillsToReview: [],
      methodKey: "missions.c5_ad.method",
      nextStepKey: "missions.c5_ad.next",
      report: t("missions.c5_ad.title") + ` — ${score}/100`,
    };
  },
};

export const c5_sim: MissionDef = {
  id: "c5_sim",
  chapter: 5,
  kind: "simulation",
  skillIds: ["linux_admin", "web_hosting", "active_directory", "services"],
  prereq: ["c5_ad"],
  difficulty: 3,
  hasVariants: true,
  variants: ["nginx", "vhost", "ad"],
  estimateMin: 14,
  titleKey: "missions.c5_sim.title",
  briefKey: "missions.c5_sim.brief",
  onStart: (fx, _state, variant) => {
    restoreIntranet(fx);
    fx.setWorld((w) => {
      w.vhosts = { ...seedVhosts(), ...(w.vhosts ?? {}) };
      w.vhosts[RH] = { ...seedVhosts()[RH]!, enabled: true };
      w.dns = { ...(w.dns ?? {}), [RH]: RH_IP };
      const dir = { ...seedDirectory(), ...(w.directory ?? {}) };
      dir.jmorel = {
        sam: "jmorel",
        displayName: "Jules Morel",
        ou: "OU=Users,DC=horizon,DC=local",
        groups: ["Domain Users"],
        enabled: true,
        locked: false,
      };
      w.directory = dir;
    });
    if (variant === "nginx") {
      fx.mutateHost("SRV-WEB", (h) => {
        h.services.nginx = "failed";
      });
    } else if (variant === "vhost") {
      fx.setWorld((w) => {
        if (w.vhosts?.[RH]) w.vhosts[RH] = { ...w.vhosts[RH], enabled: false };
      });
    } else {
      fx.setWorld((w) => {
        if (w.directory?.jmorel) {
          w.directory.jmorel.locked = true;
          w.directory.jmorel.enabled = false;
        }
      });
    }
    fx.mail({
      from: "lena",
      subjectKey: "missions.c5_sim.mailSubject",
      bodyKey: "missions.c5_sim.mailBody",
    });
    fx.chat("itsupport", "lena", fx.t("missions.c5_sim.chatLena1"));
    fx.notify({
      severity: "high",
      source: "Academy",
      titleKey: "missions.c5_sim.mailSubject",
      kind: "system",
      linkMission: "c5_sim",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c5_sim.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c5_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.c5_sim.t1", hintKey: "missions.c5_sim.h1" },
        { id: "t2", labelKey: "missions.c5_sim.t2", hintKey: "missions.c5_sim.h2" },
        { id: "t3", labelKey: "missions.c5_sim.t3", hintKey: "missions.c5_sim.h3" },
        { id: "t4", labelKey: "missions.c5_sim.t4", hintKey: "missions.c5_sim.h4" },
        { id: "t5", labelKey: "missions.c5_sim.t5", hintKey: "missions.c5_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        const v = mission.variant;
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c5s_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c5s_call",
            kind: "call",
            speaker: "lena",
            contextKey: "missions.c5_sim.callContext",
            questionKey: "missions.c5_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c5_sim.callA",
                correct: true,
                consequenceKey: "missions.c5_sim.callConsequenceA",
                whyKey: "missions.c5_sim.callConsequenceA",
                rep: 3,
              },
              {
                id: "B",
                labelKey: "missions.c5_sim.callB",
                consequenceKey: "missions.c5_sim.callConsequenceB",
                whyKey: "missions.c5_sim.callConsequenceB",
                rep: -2,
              },
              {
                id: "C",
                labelKey: "missions.c5_sim.callC",
                consequenceKey: "missions.c5_sim.callConsequenceC",
                whyKey: "missions.c5_sim.callConsequenceC",
                rep: -5,
              },
            ],
          });
        }
        if (e.type === "cmd") done.push("t2");
        const webOk = siteOk("WS-001", "intranet.horizon", state);
        const rhOk = rhLive(state);
        const adOk = userReady(state, "jmorel");
        if (v === "nginx" && webOk) done.push("t3", "t4");
        if (v === "vhost" && rhOk) done.push("t3", "t4");
        if (v === "ad" && adOk) done.push("t3", "t4");
        if (webOk && rhOk && adOk) done.push("t4");
        if (e.type === "chat-sent" && e.channel === "itsupport" && webOk && (v !== "vhost" || rhOk) && (v !== "ad" || adOk) && (v !== "nginx" || webOk)) {
          done.push("t5");
        }
        const ids = ["t1", "t2", "t3", "t4", "t5"];
        const complete =
          ((v === "nginx" && webOk) || (v === "vhost" && rhOk) || (v === "ad" && adOk) || (webOk && rhOk && adOk)) &&
          (done.includes("t5") || (e.type === "chat-sent" && e.channel === "itsupport"));
        void ids;
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete: !!complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(150);
        fx.skill("linux_admin", "competent", 15);
        fx.skill("web_hosting", "practice", 15);
        fx.skill("active_directory", "practice", 15);
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = scoreOf(mission);
    const v = mission.variant;
    return {
      missionId: "c5_sim",
      titleKey: "missions.c5_sim.title",
      outcome: mission.errors ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "linux_admin", level: "practice" },
        { id: "web_hosting", level: "practice" },
        { id: "active_directory", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c5_sim.method",
      nextStepKey: "missions.c5_sim.next",
      report: [
        t("missions.c5_sim.reportSubject"),
        `Cause: ${t(`missions.c5_sim.cause_${v}`)}`,
        `${score}/100`,
      ].join("\n"),
    };
  },
};
