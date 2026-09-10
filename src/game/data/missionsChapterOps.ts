// Chapters 12–15 — legendary defensive ops (ASTRAL / ORBIT / BASTION / MANDAT)
import type { DebriefData, EngineEvent, GameState, MissionDef, MissionRuntime } from "../types";
import {
  legendOf,
  seedAstralSite,
  seedBastion,
  seedMandat,
  seedOrbitCloud,
} from "./legend";
import {
  EDR_HOST,
  clearHostIsolation,
  hostIsolated,
  injectBeaconLogs,
} from "./defend";

function scoreOf(mission: { errors: number; hintsUsed: number }): number {
  return Math.max(50, 100 - mission.errors * 12 - mission.hintsUsed * 8);
}

function markError(mission: { errors: number; errorKeys: string[] }, key: string): void {
  if (mission.errorKeys.includes(key)) return;
  mission.errors += 1;
  mission.errorKeys.push(key);
}

type Spec = {
  id: string;
  chapter: number;
  kind: "lab" | "mission" | "simulation";
  prereq: string[];
  skills: string[];
  variants?: string[];
  channel: "soc" | "itsupport";
  decisionId: string;
  errorKey: string;
  badge?: string;
  xp: number;
  skillA: [string, "practice" | "learning", number];
  mail?: boolean;
  seed: (world: GameState["world"], variant?: string) => void;
  ready: (state: GameState, variant?: string) => boolean;
  onEvent?: (state: GameState, e: EngineEvent, mission: MissionRuntime) => void;
};

function opsMission(spec: Spec): MissionDef {
  return {
    id: spec.id,
    chapter: spec.chapter,
    kind: spec.kind,
    skillIds: spec.skills,
    prereq: spec.prereq,
    difficulty: spec.kind === "simulation" ? 3 : 2,
    hasVariants: !!spec.variants?.length,
    variants: spec.variants,
    estimateMin: spec.kind === "simulation" ? 14 : 15,
    titleKey: `missions.${spec.id}.title`,
    briefKey: `missions.${spec.id}.brief`,
    onStart: (fx, state, variant) => {
      fx.setWorld((w) => spec.seed(w, variant));
      if (spec.mail) {
        fx.mail({
          from: spec.chapter >= 15 ? "lena" : "soriya",
          subjectKey: `missions.${spec.id}.mailSubject`,
          bodyKey: `missions.${spec.id}.mailBody`,
        });
      }
      fx.chat(spec.channel, spec.chapter >= 15 ? "lena" : "soriya", fx.t(`missions.${spec.id}.chatSoriya1`));
    },
    steps: [
      { id: "brief", type: "brief", enter: (fx) => fx.objective(`missions.${spec.id}.obj1`) },
      {
        id: "tasks",
        type: "tasks",
        objectiveKey: `missions.${spec.id}.obj2`,
        tasks: [
          { id: "t1", labelKey: `missions.${spec.id}.t1`, hintKey: `missions.${spec.id}.h1` },
          { id: "t2", labelKey: `missions.${spec.id}.t2`, hintKey: `missions.${spec.id}.h2` },
          { id: "t3", labelKey: `missions.${spec.id}.t3`, hintKey: `missions.${spec.id}.h3` },
          { id: "t4", labelKey: `missions.${spec.id}.t4`, hintKey: `missions.${spec.id}.h4` },
          { id: "t5", labelKey: `missions.${spec.id}.t5`, hintKey: `missions.${spec.id}.h5` },
        ],
        handle: ({ fx, state, event: e, mission }) => {
          const done: string[] = [];
          const v = mission.variant;
          if (e.type === "mail-read" || e.type === "cmd" || (e.type === "app-opened" && (e.app === "terminal" || e.app === "browser" || e.app === "soc" || e.app === "network" || e.app === "mail"))) {
            done.push("t1");
          }
          if (
            (done.includes("t1") || mission.tasks.t1?.done) &&
            !mission.decisions[spec.decisionId] &&
            !state.pendingDecision
          ) {
            const lab = spec.kind === "lab";
            fx.setDecision({
              id: spec.decisionId,
              kind: spec.mail ? "call" : "decision",
              speaker: spec.chapter >= 15 ? "lena" : "soriya",
              contextKey: `missions.${spec.id}.${spec.mail ? "callContext" : "decisionContext"}`,
              questionKey: `missions.${spec.id}.${spec.mail ? "callQuestion" : "decisionQuestion"}`,
              options: lab
                ? [
                    {
                      id: "A",
                      labelKey: `missions.${spec.id}.decA`,
                      consequenceKey: `missions.${spec.id}.decConsequenceA`,
                      whyKey: `missions.${spec.id}.learningWhy`,
                      rep: -7,
                      fx: (fxx, s) => {
                        const rt = s.missions[spec.id];
                        if (rt) markError(rt, spec.errorKey);
                        fxx.setLearning({
                          titleKey: `missions.${spec.id}.learningTitle`,
                          impactKey: `missions.${spec.id}.learningImpact`,
                          whyKey: `missions.${spec.id}.learningWhy`,
                          checkKey: `missions.${spec.id}.learningCheck`,
                        });
                      },
                    },
                    {
                      id: "B",
                      labelKey: `missions.${spec.id}.decB`,
                      correct: true,
                      consequenceKey: `missions.${spec.id}.decConsequenceB`,
                      whyKey: `missions.${spec.id}.decConsequenceB`,
                      rep: 6,
                    },
                  ]
                : [
                    {
                      id: "A",
                      labelKey: `missions.${spec.id}.callA`,
                      correct: true,
                      consequenceKey: `missions.${spec.id}.callConsequenceA`,
                      whyKey: `missions.${spec.id}.callConsequenceA`,
                      rep: 5,
                    },
                    {
                      id: "B",
                      labelKey: `missions.${spec.id}.callB`,
                      consequenceKey: `missions.${spec.id}.callConsequenceB`,
                      whyKey: `missions.${spec.id}.callConsequenceB`,
                      rep: -4,
                    },
                    ...(spec.kind === "simulation"
                      ? [
                          {
                            id: "C",
                            labelKey: `missions.${spec.id}.callC`,
                            consequenceKey: `missions.${spec.id}.callConsequenceC`,
                            whyKey: `missions.${spec.id}.callConsequenceC`,
                            rep: -8,
                            fx: (_fxx: unknown, s: GameState) => {
                              const rt = s.missions[spec.id];
                              if (rt) markError(rt, spec.errorKey);
                            },
                          },
                        ]
                      : []),
                  ],
            });
          }
          spec.onEvent?.(state, e, mission);
          if (e.type === "cmd" || e.type === "action") done.push("t2");
          const ok = spec.ready(state, v);
          if (ok) done.push("t3", "t4");
          if (e.type === "chat-sent" && e.channel === spec.channel && ok) done.push("t5");
          const complete = ok && e.type === "chat-sent" && e.channel === spec.channel;
          return { doneTasks: done.filter((id) => !mission.tasks[id]?.done), complete };
        },
      },
      {
        id: "final",
        type: "final",
        enter: (fx) => {
          fx.awardXp(spec.xp);
          if (spec.badge) fx.awardBadge(spec.badge);
          fx.skill(spec.skillA[0], spec.skillA[1], spec.skillA[2]);
          fx.chat(spec.channel, spec.chapter >= 15 ? "lena" : "soriya", fx.t(`missions.${spec.id}.chatDone`));
          fx.sound("success");
        },
      },
    ],
    debrief: (_state, mission, t): DebriefData => {
      const v = mission.variant;
      const report = spec.variants
        ? [t(`missions.${spec.id}.reportSubject`), `Cause: ${t(`missions.${spec.id}.cause_${v}`)}`, `${scoreOf(mission)}/100`].join("\n")
        : t(`missions.${spec.id}.title`) + ` — ${scoreOf(mission)}/100`;
      return {
        missionId: spec.id,
        titleKey: `missions.${spec.id}.title`,
        outcome: mission.errors ? "partial" : "success",
        score: scoreOf(mission),
        maxScore: 100,
        errors: [],
        skillsValidated: [{ id: spec.skills[0], level: "practice" }],
        skillsToReview: [],
        methodKey: `missions.${spec.id}.method`,
        nextStepKey: `missions.${spec.id}.next`,
        report,
      };
    },
  };
}

function L(state: GameState) {
  return legendOf(state);
}

export const e10_lab = opsMission({
  id: "e10_lab",
  chapter: 12,
  kind: "lab",
  prereq: ["e9_sim"],
  skills: ["web_security", "http", "web_hosting"],
  channel: "soc",
  decisionId: "e10_open",
  errorKey: "open_dir",
  badge: "astral_vitrine",
  xp: 140,
  skillA: ["web_security", "practice", 20],
  seed: (w) => seedAstralSite(w),
  ready: (s) => L(s).headers && !L(s).autoindex,
});

export const e10_web = opsMission({
  id: "e10_web",
  chapter: 12,
  kind: "mission",
  prereq: ["e10_lab"],
  skills: ["web_security", "http", "auth"],
  channel: "soc",
  decisionId: "e10w_call",
  errorKey: "skip_tls",
  xp: 130,
  skillA: ["http", "practice", 15],
  mail: true,
  seed: (w) => seedAstralSite(w),
  ready: (s) => L(s).tls && L(s).proxy && L(s).headers,
  onEvent: (_s, e, mission) => {
    if (e.type === "cmd" && (e.argv ?? []).some((a) => a.toLowerCase() === "autoindex") && (e.argv ?? []).some((a) => a === "on")) {
      markError(mission, "open_dir");
    }
  },
});

export const e10_sim = opsMission({
  id: "e10_sim",
  chapter: 12,
  kind: "simulation",
  prereq: ["e10_web"],
  skills: ["web_security", "api_security"],
  variants: ["headers", "tls", "proxy"],
  channel: "soc",
  decisionId: "e10x_call",
  errorKey: "skip_tls",
  xp: 160,
  skillA: ["web_security", "practice", 15],
  mail: true,
  seed: (w) => seedAstralSite(w),
  ready: (s, v) => {
    if (v === "headers") return L(s).headers && !L(s).autoindex;
    if (v === "tls") return L(s).tls;
    return L(s).proxy;
  },
});

export const e11_lab = opsMission({
  id: "e11_lab",
  chapter: 13,
  kind: "lab",
  prereq: ["e10_sim"],
  skills: ["cloud_network", "cloud_iam"],
  channel: "soc",
  decisionId: "e11_sg",
  errorKey: "leave_sg",
  badge: "orbit_cloud",
  xp: 140,
  skillA: ["cloud_network", "practice", 20],
  seed: (w) => seedOrbitCloud(w),
  ready: (s) => !L(s).sgOpen,
});

export const e11_iam = opsMission({
  id: "e11_iam",
  chapter: 13,
  kind: "mission",
  prereq: ["e11_lab"],
  skills: ["cloud_iam", "git", "sast"],
  channel: "soc",
  decisionId: "e11i_call",
  errorKey: "commit_secret",
  xp: 130,
  skillA: ["cloud_iam", "practice", 15],
  mail: true,
  seed: (w) => seedOrbitCloud(w),
  ready: (s) => !L(s).iamAdmin && !L(s).gitSecret,
});

export const e11_sim = opsMission({
  id: "e11_sim",
  chapter: 13,
  kind: "simulation",
  prereq: ["e11_iam"],
  skills: ["cloud_iam", "cloud_network", "git"],
  variants: ["sg", "iam", "secret"],
  channel: "soc",
  decisionId: "e11x_call",
  errorKey: "leave_admin",
  xp: 160,
  skillA: ["cloud_iam", "practice", 15],
  mail: true,
  seed: (w) => seedOrbitCloud(w),
  ready: (s, v) => {
    if (v === "sg") return !L(s).sgOpen;
    if (v === "iam") return !L(s).iamAdmin;
    return !L(s).gitSecret;
  },
});

export const e12_lab = opsMission({
  id: "e12_lab",
  chapter: 14,
  kind: "lab",
  prereq: ["e11_sim"],
  skills: ["seg_arch", "zero_trust"],
  channel: "soc",
  decisionId: "e12_flat",
  errorKey: "flat_net",
  badge: "bastion_arch",
  xp: 150,
  skillA: ["seg_arch", "practice", 20],
  seed: (w) => seedBastion(w),
  ready: (s) => L(s).bastion && L(s).otIsolated,
});

export const e12_zt = opsMission({
  id: "e12_zt",
  chapter: 14,
  kind: "mission",
  prereq: ["e12_lab"],
  skills: ["zero_trust", "iam", "pki"],
  channel: "soc",
  decisionId: "e12z_call",
  errorKey: "skip_ot",
  xp: 140,
  skillA: ["zero_trust", "practice", 15],
  mail: true,
  seed: (w) => seedBastion(w),
  ready: (s) => L(s).zt && L(s).bastion,
});

export const e12_sim = opsMission({
  id: "e12_sim",
  chapter: 14,
  kind: "simulation",
  prereq: ["e12_zt"],
  skills: ["seg_arch", "zero_trust", "pki"],
  variants: ["bastion", "ot", "zt"],
  channel: "soc",
  decisionId: "e12x_call",
  errorKey: "flat_net",
  xp: 170,
  skillA: ["zero_trust", "practice", 15],
  mail: true,
  seed: (w) => seedBastion(w),
  ready: (s, v) => {
    if (v === "bastion") return L(s).bastion;
    if (v === "ot") return L(s).otIsolated;
    return L(s).zt;
  },
});

export const e13_lab = opsMission({
  id: "e13_lab",
  chapter: 15,
  kind: "lab",
  prereq: ["e12_sim"],
  skills: ["risk", "audit"],
  channel: "itsupport",
  decisionId: "e13_stamp",
  errorKey: "rubber_stamp",
  badge: "mandat_grc",
  xp: 140,
  skillA: ["risk", "practice", 20],
  seed: (w) => seedMandat(w),
  ready: (s) => L(s).riskClosed && L(s).policySigned,
});

export const e13_audit = opsMission({
  id: "e13_audit",
  chapter: 15,
  kind: "mission",
  prereq: ["e13_lab"],
  skills: ["audit", "risk"],
  channel: "itsupport",
  decisionId: "e13a_call",
  errorKey: "ignore_audit",
  xp: 130,
  skillA: ["audit", "practice", 15],
  mail: true,
  seed: (w) => seedMandat(w),
  ready: (s) => L(s).supplierHeld && L(s).policySigned,
});

export const e13_sim = opsMission({
  id: "e13_sim",
  chapter: 15,
  kind: "simulation",
  prereq: ["e13_audit"],
  skills: ["risk", "audit"],
  variants: ["risk", "policy", "supplier"],
  channel: "itsupport",
  decisionId: "e13x_call",
  errorKey: "rubber_stamp",
  xp: 160,
  skillA: ["audit", "practice", 15],
  mail: true,
  seed: (w) => seedMandat(w),
  ready: (s, v) => {
    if (v === "risk") return L(s).riskClosed;
    if (v === "policy") return L(s).policySigned;
    return L(s).supplierHeld;
  },
});

function seedApogee(world: GameState["world"]): void {
  seedAstralSite(world);
  seedOrbitCloud(world);
  seedBastion(world);
  seedMandat(world);
  clearHostIsolation(world, EDR_HOST);
  injectBeaconLogs(world);
}

export const e14_lab = opsMission({
  id: "e14_lab",
  chapter: 16,
  kind: "lab",
  prereq: ["e13_sim"],
  skills: ["incident_response", "web_security"],
  channel: "soc",
  decisionId: "e14_cut",
  errorKey: "cut_all",
  badge: "apogee_capstone",
  xp: 180,
  skillA: ["incident_response", "practice", 20],
  seed: (w) => seedApogee(w),
  ready: (s) => hostIsolated(s, EDR_HOST) && L(s).headers && !L(s).autoindex,
});

export const e14_cross = opsMission({
  id: "e14_cross",
  chapter: 16,
  kind: "mission",
  prereq: ["e14_lab"],
  skills: ["cloud_network", "zero_trust"],
  channel: "soc",
  decisionId: "e14x_call",
  errorKey: "skip_zt",
  xp: 170,
  skillA: ["zero_trust", "practice", 15],
  mail: true,
  seed: (w) => seedApogee(w),
  ready: (s) => !L(s).sgOpen && L(s).bastion && L(s).zt,
});

export const e14_sim = opsMission({
  id: "e14_sim",
  chapter: 16,
  kind: "simulation",
  prereq: ["e14_cross"],
  skills: ["incident_response", "risk", "web_security"],
  variants: ["contain", "portal", "govern"],
  channel: "soc",
  decisionId: "e14s_call",
  errorKey: "cut_all",
  xp: 200,
  skillA: ["incident_response", "practice", 15],
  mail: true,
  seed: (w) => seedApogee(w),
  ready: (s, v) => {
    if (v === "contain") return hostIsolated(s, EDR_HOST);
    if (v === "portal") return L(s).headers && !L(s).autoindex;
    return L(s).policySigned;
  },
});
