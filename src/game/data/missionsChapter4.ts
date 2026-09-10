// Chapter 4 — Helpdesk Windows / Wi-Fi / printer
import type { DebriefData, GameState, MissionDef } from "../types";
import { ipReachable, resolveName } from "../terminal";
import {
  WIFI_CORP_SSID,
  WIFI_GUEST_SSID,
  associateWifi,
} from "./world";

const cmd = (e: { type: string; argv?: string[] }, name: string) =>
  e.type === "cmd" && (e.argv?.[0] ?? "").toLowerCase() === name;

const onHost = (e: { type: string; hostId?: string }, host: string) =>
  e.type === "cmd" && e.hostId === host;

const argvHas = (e: { argv?: string[] }, ...needles: string[]) => {
  const argv = (e.argv ?? []).map((a) => a.toLowerCase());
  return needles.every((n) => argv.some((a) => a.includes(n.toLowerCase())));
};

function intranetOk(hostId: string, state: GameState): boolean {
  const h = state.world.hosts[hostId];
  if (!h) return false;
  const ip = resolveName("intranet.horizon", h, state);
  return !!ip && ipReachable(ip, h, state);
}

function resetWinBench(fx: {
  mutateHost: (id: string, fn: (h: GameState["world"]["hosts"][string]) => void) => void;
}) {
  fx.mutateHost("PC-WIN", (h) => {
    h.ifaces.Ethernet = { state: "up", dhcp: false, ip: "192.168.10.55", cidr: 24, gw: "192.168.10.1" };
    h.ifaces["Wi-Fi"] = { state: "down", dhcp: true };
    h.dns = ["10.0.0.10"];
    h.wifiClient = { ssid: null, connected: false };
    h.services.spooler = "active";
  });
}

export const c4_lab: MissionDef = {
  id: "c4_lab",
  chapter: 4,
  kind: "lab",
  skillIds: ["windows_admin", "computer_basics", "network_diag", "dns"],
  prereq: ["c3_sim"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.c4_lab.title",
  briefKey: "missions.c4_lab.brief",
  onStart: (fx) => {
    fx.mutateHost("PC-WIN", (h) => {
      h.ifaces.Ethernet = { state: "up", dhcp: false, ip: "192.168.10.55", cidr: 24, gw: "192.168.10.1" };
      h.ifaces["Wi-Fi"] = { state: "down", dhcp: true };
      h.dns = ["8.8.8.8"];
      h.wifiClient = { ssid: null, connected: false };
    });
    fx.objective("missions.c4_lab.obj1");
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => {
        fx.objective("missions.c4_lab.obj1");
        fx.notify({
          severity: "info",
          source: "Academy",
          titleKey: "notifyContent.missionReady",
          kind: "system",
          linkMission: "c4_lab",
        });
      },
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c4_lab.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c4_lab.t1", hintKey: "missions.c4_lab.h1" },
        { id: "t2", labelKey: "missions.c4_lab.t2", hintKey: "missions.c4_lab.h2" },
        { id: "t3", labelKey: "missions.c4_lab.t3", hintKey: "missions.c4_lab.h3" },
        { id: "t4", labelKey: "missions.c4_lab.t4", hintKey: "missions.c4_lab.h4" },
        { id: "t5", labelKey: "missions.c4_lab.t5", hintKey: "missions.c4_lab.h5" },
        { id: "t6", labelKey: "missions.c4_lab.t6", hintKey: "missions.c4_lab.h6" },
        { id: "t7", labelKey: "missions.c4_lab.t7", hintKey: "missions.c4_lab.h7" },
        { id: "t8", labelKey: "missions.c4_lab.t8", hintKey: "missions.c4_lab.h8" },
      ],
      handle: ({ state, event: e, mission }) => {
        const done: string[] = [];
        const win = state.world.hosts["PC-WIN"];
        if (e.type === "app-opened" && e.app === "terminal") done.push("t1");
        if (onHost(e, "PC-WIN") && cmd(e, "help")) done.push("t1");
        if (onHost(e, "PC-WIN") && cmd(e, "ipconfig") && !argvHas(e, "/all")) done.push("t2");
        if (onHost(e, "PC-WIN") && cmd(e, "ping") && (e.argv ?? []).includes("192.168.10.1")) done.push("t3");
        if (onHost(e, "PC-WIN") && cmd(e, "ping") && (e.argv ?? []).includes("10.0.0.10")) done.push("t4");
        if (onHost(e, "PC-WIN") && cmd(e, "ping") && (e.argv ?? []).includes("intranet.horizon")) {
          if (win && win.dns[0] !== "10.0.0.10") done.push("t5");
          if (intranetOk("PC-WIN", state)) done.push("t8");
        }
        if (onHost(e, "PC-WIN") && cmd(e, "ipconfig") && argvHas(e, "/all")) done.push("t6");
        if (onHost(e, "PC-WIN") && cmd(e, "netsh") && argvHas(e, "dns") && win?.dns[0] === "10.0.0.10") {
          done.push("t7");
        }
        const ids = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
        const complete =
          done.includes("t8") ||
          ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(110);
        fx.awardBadge("first_network");
        fx.skill("windows_admin", "practice", 20);
        fx.skill("computer_basics", "practice", 15);
        fx.skill("network_diag", "practice", 10);
        fx.chat("itsupport", "lena", fx.t("missions.c4_lab.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    return {
      missionId: "c4_lab",
      titleKey: "missions.c4_lab.title",
      outcome: mission.hintsUsed > 3 ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "windows_admin", level: "practice" },
        { id: "computer_basics", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c4_lab.method",
      nextStepKey: "missions.c4_lab.next",
      report: t("missions.c4_lab.title") + ` — ${score}/100`,
    };
  },
};

export const c4_wifi: MissionDef = {
  id: "c4_wifi",
  chapter: 4,
  kind: "mission",
  skillIds: ["wifi", "windows_admin", "vlan", "network_diag"],
  prereq: ["c4_lab"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 16,
  titleKey: "missions.c4_wifi.title",
  briefKey: "missions.c4_wifi.brief",
  onStart: (fx, state) => {
    fx.mutateHost("AP-01", (h) => {
      h.wifiAp = { ssid: WIFI_GUEST_SSID, vlan: 30, enabled: true };
    });
    fx.mutateHost("PC-AMINA", (h) => {
      const ap = state.world.hosts["AP-01"];
      if (ap) associateWifi(h, ap);
    });
    fx.setWorld((w) => {
      w.enforceAccessVlan = true;
      w.tickets = w.tickets.filter((t) => t.id !== "IT-4101");
      w.tickets.push({
        id: "IT-4101",
        severity: "medium",
        titleKey: "missions.c4_wifi.mailTicketSubject",
        from: "Amina Diallo (Accueil)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: "PC-AMINA",
      });
    });
    fx.mail({
      from: "itsd",
      subjectKey: "missions.c4_wifi.mailTicketSubject",
      bodyKey: "missions.c4_wifi.mailTicketBody",
    });
    fx.chat("itsupport", "amina", fx.t("missions.c4_wifi.chatAmina1"));
    fx.notify({
      severity: "high",
      source: "IT Service Desk",
      titleKey: "missions.c4_wifi.mailTicketSubject",
      kind: "it",
      linkMission: "c4_wifi",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c4_wifi.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c4_wifi.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c4_wifi.t1", hintKey: "missions.c4_wifi.h1" },
        { id: "t2", labelKey: "missions.c4_wifi.t2", hintKey: "missions.c4_wifi.h2" },
        { id: "t3", labelKey: "missions.c4_wifi.t3", hintKey: "missions.c4_wifi.h3" },
        { id: "t4", labelKey: "missions.c4_wifi.t4", hintKey: "missions.c4_wifi.h4" },
        { id: "t5", labelKey: "missions.c4_wifi.t5", hintKey: "missions.c4_wifi.h5" },
        { id: "t6", labelKey: "missions.c4_wifi.t6", hintKey: "missions.c4_wifi.h6" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c4w_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c4w_call",
            kind: "call",
            speaker: "amina",
            contextKey: "missions.c4_wifi.callContext",
            questionKey: "missions.c4_wifi.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c4_wifi.callA",
                correct: true,
                consequenceKey: "missions.c4_wifi.callConsequenceA",
                whyKey: "missions.c4_wifi.callConsequenceA",
                rep: 4,
              },
              {
                id: "B",
                labelKey: "missions.c4_wifi.callB",
                consequenceKey: "missions.c4_wifi.callConsequenceB",
                whyKey: "missions.c4_wifi.callConsequenceB",
                rep: -4,
              },
              {
                id: "C",
                labelKey: "missions.c4_wifi.callC",
                consequenceKey: "missions.c4_wifi.callConsequenceC",
                whyKey: "missions.c4_wifi.callConsequenceC",
                rep: -6,
              },
            ],
          });
        }
        if (onHost(e, "AP-01") && (cmd(e, "info") || cmd(e, "show") || cmd(e, "help"))) done.push("t2");
        const ap = state.world.hosts["AP-01"]?.wifiAp;
        if (ap?.ssid === WIFI_CORP_SSID) done.push("t3");
        if (ap?.ssid === WIFI_CORP_SSID && ap.vlan === 10) done.push("t4");
        const amina = state.world.hosts["PC-AMINA"];
        if (amina?.wifiClient?.connected && amina.wifiClient.ssid === WIFI_CORP_SSID && ap?.vlan === 10) {
          done.push("t5");
        }
        if (
          (e.type === "chat-sent" && e.channel === "itsupport") &&
          intranetOk("PC-AMINA", state)
        ) {
          done.push("t6");
        }
        if (
          (done.includes("t2") || mission.tasks.t2?.done) &&
          mission.decisions["c4w_call"] &&
          !mission.decisions["c4w_lena"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c4w_lena",
            kind: "decision",
            contextKey: "missions.c4_wifi.decisionContext",
            questionKey: "missions.c4_wifi.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c4_wifi.decA",
                consequenceKey: "missions.c4_wifi.decConsequenceA",
                whyKey: "missions.c4_wifi.learningWhy",
                rep: -6,
                fx: (fxx, s) => {
                  const rt = s.missions["c4_wifi"];
                  if (rt && !rt.errorKeys.includes("left_guest_ssid")) {
                    rt.errors += 1;
                    rt.errorKeys.push("left_guest_ssid");
                  }
                  fxx.setLearning({
                    titleKey: "missions.c4_wifi.learningTitle",
                    impactKey: "missions.c4_wifi.learningImpact",
                    whyKey: "missions.c4_wifi.learningWhy",
                    checkKey: "missions.c4_wifi.learningCheck",
                  });
                  fxx.sound("alert");
                },
              },
              {
                id: "B",
                labelKey: "missions.c4_wifi.decB",
                correct: true,
                consequenceKey: "missions.c4_wifi.decConsequenceB",
                whyKey: "missions.c4_wifi.decConsequenceB",
                rep: 4,
              },
              {
                id: "C",
                labelKey: "missions.c4_wifi.decC",
                consequenceKey: "missions.c4_wifi.decConsequenceC",
                whyKey: "missions.c4_wifi.learningWhy",
                rep: -4,
              },
            ],
          });
        }
        const ids = ["t1", "t2", "t3", "t4", "t5", "t6"];
        const complete = ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(130);
        fx.skill("wifi", "practice", 25);
        fx.skill("windows_admin", "practice", 10);
        fx.chat("itsupport", "lena", fx.t("missions.c4_wifi.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    const errors: DebriefData["errors"] = [];
    if (mission.errorKeys.includes("left_guest_ssid")) {
      errors.push({
        whatKey: "missions.c4_wifi.decisionQuestion",
        whyKey: "missions.c4_wifi.learningWhy",
      });
    }
    return {
      missionId: "c4_wifi",
      titleKey: "missions.c4_wifi.title",
      outcome: errors.length ? "partial" : "success",
      score,
      maxScore: 100,
      errors,
      skillsValidated: [{ id: "wifi", level: "practice" }],
      skillsToReview: errors.length ? ["wifi"] : [],
      methodKey: "missions.c4_wifi.method",
      nextStepKey: "missions.c4_wifi.next",
      report: t("missions.c4_wifi.title") + ` — ${score}/100`,
    };
  },
};

export const c4_desk: MissionDef = {
  id: "c4_desk",
  chapter: 4,
  kind: "mission",
  skillIds: ["windows_admin", "computer_basics", "network_diag"],
  prereq: ["c4_wifi"],
  difficulty: 2,
  hasVariants: false,
  estimateMin: 14,
  titleKey: "missions.c4_desk.title",
  briefKey: "missions.c4_desk.brief",
  onStart: (fx, state) => {
    fx.mutateHost("AP-01", (h) => {
      h.wifiAp = { ssid: WIFI_CORP_SSID, vlan: 10, enabled: true };
    });
    fx.mutateHost("PC-AMINA", (h) => {
      const ap = { ...state.world.hosts["AP-01"], wifiAp: { ssid: WIFI_CORP_SSID, vlan: 10, enabled: true } };
      associateWifi(h, ap);
      h.accounts = { amina: { name: "amina", locked: true, active: false } };
      h.services.spooler = "inactive";
    });
    fx.setWorld((w) => {
      w.tickets = w.tickets.filter((t) => t.id !== "IT-4102");
      w.tickets.push({
        id: "IT-4102",
        severity: "medium",
        titleKey: "missions.c4_desk.mailTicketSubject",
        from: "Amina Diallo (Accueil)",
        status: "open",
        createdAt: state.timeMin,
        relatedHost: "PC-AMINA",
      });
    });
    fx.mail({
      from: "itsd",
      subjectKey: "missions.c4_desk.mailTicketSubject",
      bodyKey: "missions.c4_desk.mailTicketBody",
    });
    fx.chat("itsupport", "amina", fx.t("missions.c4_desk.chatAmina1"));
    fx.notify({
      severity: "medium",
      source: "IT Service Desk",
      titleKey: "missions.c4_desk.mailTicketSubject",
      kind: "it",
      linkMission: "c4_desk",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c4_desk.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c4_desk.obj2",
      tasks: [
        { id: "t1", labelKey: "missions.c4_desk.t1", hintKey: "missions.c4_desk.h1" },
        { id: "t2", labelKey: "missions.c4_desk.t2", hintKey: "missions.c4_desk.h2" },
        { id: "t3", labelKey: "missions.c4_desk.t3", hintKey: "missions.c4_desk.h3" },
        { id: "t4", labelKey: "missions.c4_desk.t4", hintKey: "missions.c4_desk.h4" },
        { id: "t5", labelKey: "missions.c4_desk.t5", hintKey: "missions.c4_desk.h5" },
        { id: "t6", labelKey: "missions.c4_desk.t6", hintKey: "missions.c4_desk.h6" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read" || (e.type === "chat-sent" && e.channel === "itsupport")) done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c4d_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c4d_call",
            kind: "call",
            speaker: "amina",
            contextKey: "missions.c4_desk.callContext",
            questionKey: "missions.c4_desk.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c4_desk.callA",
                correct: true,
                consequenceKey: "missions.c4_desk.callConsequenceA",
                whyKey: "missions.c4_desk.callConsequenceA",
                rep: 3,
              },
              {
                id: "B",
                labelKey: "missions.c4_desk.callB",
                consequenceKey: "missions.c4_desk.callConsequenceB",
                whyKey: "missions.c4_desk.callConsequenceB",
                rep: -4,
              },
              {
                id: "C",
                labelKey: "missions.c4_desk.callC",
                consequenceKey: "missions.c4_desk.callConsequenceC",
                whyKey: "missions.c4_desk.callConsequenceC",
                rep: -5,
              },
            ],
          });
        }
        if (onHost(e, "PC-AMINA") && cmd(e, "net") && argvHas(e, "user")) done.push("t2");
        const acc = state.world.hosts["PC-AMINA"]?.accounts?.amina;
        if (acc && acc.active && !acc.locked) done.push("t3");
        if (state.world.hosts["PC-AMINA"]?.services.spooler === "active") done.push("t4");
        if (onHost(e, "PC-AMINA") && cmd(e, "ping") && (e.argv ?? []).includes("192.168.10.88")) done.push("t5");
        if (e.type === "chat-sent" && e.channel === "itsupport" && acc?.active && !acc.locked) done.push("t6");
        if (
          (done.includes("t2") || mission.tasks.t2?.done) &&
          mission.decisions["c4d_call"] &&
          !mission.decisions["c4d_pwd"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c4d_pwd",
            kind: "decision",
            contextKey: "missions.c4_desk.decisionContext",
            questionKey: "missions.c4_desk.decisionQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c4_desk.decA",
                consequenceKey: "missions.c4_desk.decConsequenceA",
                whyKey: "missions.c4_desk.learningWhy",
                rep: -8,
                fx: (fxx, s) => {
                  const rt = s.missions["c4_desk"];
                  if (rt && !rt.errorKeys.includes("password_on_chat")) {
                    rt.errors += 1;
                    rt.errorKeys.push("password_on_chat");
                  }
                  fxx.setLearning({
                    titleKey: "missions.c4_desk.learningTitle",
                    impactKey: "missions.c4_desk.learningImpact",
                    whyKey: "missions.c4_desk.learningWhy",
                    checkKey: "missions.c4_desk.learningCheck",
                  });
                  fxx.sound("alert");
                },
              },
              {
                id: "B",
                labelKey: "missions.c4_desk.decB",
                correct: true,
                consequenceKey: "missions.c4_desk.decConsequenceB",
                whyKey: "missions.c4_desk.decConsequenceB",
                rep: 5,
              },
              {
                id: "C",
                labelKey: "missions.c4_desk.decC",
                consequenceKey: "missions.c4_desk.decConsequenceC",
                whyKey: "missions.c4_desk.learningWhy",
                rep: -3,
              },
            ],
          });
        }
        const ids = ["t1", "t2", "t3", "t4", "t5", "t6"];
        const complete = ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(120);
        fx.awardBadge("methodical");
        fx.skill("windows_admin", "competent", 20);
        fx.chat("itsupport", "lena", fx.t("missions.c4_desk.chatDone"));
        fx.sound("success");
      },
    },
  ],
  debrief: (_state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    const errors: DebriefData["errors"] = [];
    if (mission.errorKeys.includes("password_on_chat")) {
      errors.push({
        whatKey: "missions.c4_desk.decisionQuestion",
        whyKey: "missions.c4_desk.learningWhy",
      });
    }
    return {
      missionId: "c4_desk",
      titleKey: "missions.c4_desk.title",
      outcome: errors.length ? "partial" : "success",
      score,
      maxScore: 100,
      errors,
      skillsValidated: [{ id: "windows_admin", level: "competent" }],
      skillsToReview: errors.length ? ["windows_admin"] : [],
      methodKey: "missions.c4_desk.method",
      nextStepKey: "missions.c4_desk.next",
      report: t("missions.c4_desk.title") + ` — ${score}/100`,
    };
  },
};

export const c4_sim: MissionDef = {
  id: "c4_sim",
  chapter: 4,
  kind: "simulation",
  skillIds: ["windows_admin", "wifi", "network_diag"],
  prereq: ["c4_desk"],
  difficulty: 3,
  hasVariants: true,
  variants: ["link", "ip", "wifi"],
  estimateMin: 12,
  titleKey: "missions.c4_sim.title",
  briefKey: "missions.c4_sim.brief",
  onStart: (fx, _state, variant) => {
    fx.mutateHost("AP-01", (h) => {
      h.wifiAp = { ssid: WIFI_CORP_SSID, vlan: 10, enabled: true };
    });
    resetWinBench(fx);
    if (variant === "link") {
      fx.mutateHost("PC-WIN", (h) => {
        h.ifaces.Ethernet = { state: "down", dhcp: false, ip: "192.168.10.55", cidr: 24, gw: "192.168.10.1" };
      });
    } else if (variant === "ip") {
      fx.mutateHost("PC-WIN", (h) => {
        h.ifaces.Ethernet = { state: "up", dhcp: false, ip: "192.168.20.55", cidr: 24, gw: "192.168.20.1" };
      });
    } else {
      fx.mutateHost("PC-WIN", (h) => {
        h.ifaces.Ethernet = { state: "down", dhcp: false };
        h.ifaces["Wi-Fi"] = {
          state: "up",
          dhcp: true,
          ip: "192.168.30.51",
          cidr: 24,
          gw: "192.168.30.1",
        };
        h.wifiClient = { ssid: WIFI_GUEST_SSID, connected: true };
        h.dns = ["1.1.1.1"];
      });
    }
    fx.mail({
      from: "lena",
      subjectKey: "missions.c4_sim.mailSubject",
      bodyKey: "missions.c4_sim.mailBody",
    });
    fx.chat("itsupport", "lena", fx.t("missions.c4_sim.chatLena1"));
    fx.notify({
      severity: "high",
      source: "Academy",
      titleKey: "missions.c4_sim.mailSubject",
      kind: "system",
      linkMission: "c4_sim",
    });
  },
  steps: [
    {
      id: "brief",
      type: "brief",
      enter: (fx) => fx.objective("missions.c4_sim.obj1"),
    },
    {
      id: "tasks",
      type: "tasks",
      objectiveKey: "missions.c4_sim.obj1",
      tasks: [
        { id: "t1", labelKey: "missions.c4_sim.t1", hintKey: "missions.c4_sim.h1" },
        { id: "t2", labelKey: "missions.c4_sim.t2", hintKey: "missions.c4_sim.h2" },
        { id: "t3", labelKey: "missions.c4_sim.t3", hintKey: "missions.c4_sim.h3" },
        { id: "t4", labelKey: "missions.c4_sim.t4", hintKey: "missions.c4_sim.h4" },
        { id: "t5", labelKey: "missions.c4_sim.t5", hintKey: "missions.c4_sim.h5" },
      ],
      handle: ({ fx, state, event: e, mission }) => {
        const done: string[] = [];
        if (e.type === "mail-read") done.push("t1");
        if (
          (done.includes("t1") || mission.tasks.t1?.done) &&
          !mission.decisions["c4s_call"] &&
          !state.pendingDecision
        ) {
          fx.setDecision({
            id: "c4s_call",
            kind: "call",
            speaker: "lena",
            contextKey: "missions.c4_sim.callContext",
            questionKey: "missions.c4_sim.callQuestion",
            options: [
              {
                id: "A",
                labelKey: "missions.c4_sim.callA",
                correct: true,
                consequenceKey: "missions.c4_sim.callConsequenceA",
                whyKey: "missions.c4_sim.callConsequenceA",
                rep: 3,
              },
              {
                id: "B",
                labelKey: "missions.c4_sim.callB",
                consequenceKey: "missions.c4_sim.callConsequenceB",
                whyKey: "missions.c4_sim.callConsequenceB",
                rep: -3,
              },
              {
                id: "C",
                labelKey: "missions.c4_sim.callC",
                consequenceKey: "missions.c4_sim.callConsequenceC",
                whyKey: "missions.c4_sim.callConsequenceC",
                rep: -4,
              },
            ],
          });
        }
        if (onHost(e, "PC-WIN") && (cmd(e, "ipconfig") || cmd(e, "ping") || cmd(e, "netsh"))) done.push("t2");
        if (intranetOk("PC-WIN", state)) {
          done.push("t3");
          done.push("t4");
        }
        if (e.type === "chat-sent" && e.channel === "itsupport" && intranetOk("PC-WIN", state)) done.push("t5");
        const ids = ["t1", "t2", "t3", "t4", "t5"];
        const complete = ids.every((id) => done.includes(id) || mission.tasks[id]?.done);
        return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
      },
    },
    {
      id: "final",
      type: "final",
      enter: (fx) => {
        fx.awardXp(150);
        fx.awardBadge("methodical");
        fx.skill("windows_admin", "competent", 25);
        fx.skill("wifi", "practice", 15);
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
  debrief: (_state, mission, t): DebriefData => {
    const score = Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
    const v = mission.variant;
    return {
      missionId: "c4_sim",
      titleKey: "missions.c4_sim.title",
      outcome: mission.hintsUsed ? "partial" : "success",
      score,
      maxScore: 100,
      errors: [],
      skillsValidated: [
        { id: "windows_admin", level: "competent" },
        { id: "wifi", level: "practice" },
      ],
      skillsToReview: [],
      methodKey: "missions.c4_sim.method",
      nextStepKey: "missions.c4_sim.next",
      report: [
        t("missions.c4_sim.reportSubject"),
        `Variant: ${v}`,
        `Score: ${score}/100`,
        `Cause: ${t(`missions.c4_sim.cause_${v}`)}`,
      ].join("\n"),
    };
  },
};
