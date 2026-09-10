// ============================================================
// HORIZON CYBER ACADEMY — Game engine
// Single source of truth: world state, terminal execution,
// mission lifecycle, decisions & consequences, save system.
// The engine is framework-agnostic; React subscribes to it.
// ============================================================

import type {
  AppId,
  CareerEntry,
  Certificate,
  ChatMessage,
  DecisionOption,
  EngineEvent,
  FxApi,
  GameState,
  HostRuntime,
  Lang,
  Mail,
  MissionDef,
  MissionRuntime,
  MissionStatus,
  Notification,
  Profile,
  SaveDocument,
  SkillLevel,
  Toast,
} from "./types";
import { makeT, type TFn } from "./i18n";
import { audio } from "./audio";
import {
  CERTIFICATES,
  SKILLS,
  computeTitle,
  levelIndex,
} from "./data/curriculum";
import {
  DNS_ZONE,
  initialChat,
  initialMails,
  seedDirectory,
  seedFwRules,
  seedHosts,
  seedSwitchPorts,
  seedVhosts,
} from "./data/world";
import {
  MISSIONS,
  MISSION_ORDER,
  getMission,
} from "./data/missions";
import { execTerminal, parseNetplan } from "./terminal";
import {
  APP_IDS, CHAT_CHANNELS, MAX_TERMINAL_INPUT,
  createWorkspace, restoreWorkspace, normalizeWindowLayout, defaultWindowLayout,
  trimTerminalBlocks, type WindowLayout, type TerminalBlock,
} from "./workspace";

export interface SaveOutcome { local: boolean; remote: boolean; savedAt: number }

export const SAVE_VERSION = 3;
const LOCAL_KEY = "horizon-save-v3";

const DHCP_LEASES: Record<string, [string, number, string]> = {
  "WS-001": ["192.168.10.24", 24, "192.168.10.1"],
  "PC-MARIE": ["192.168.20.45", 24, "192.168.20.1"],
  "PC-PAUL": ["192.168.30.37", 24, "192.168.30.1"],
  "PC-WIN": ["192.168.10.55", 24, "192.168.10.1"],
  "PC-AMINA": ["192.168.10.61", 24, "192.168.10.1"],
}; // ip, cidr, gateway

function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function certId(): string {
  const block = () =>
    Array.from({ length: 4 }, () =>
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(
        Math.floor(Math.random() * 33)
      )
    ).join("");
  return `HZN-${block()}-${block()}`;
}

export function createInitialState(profile: Profile): GameState {
  const missions: Record<string, MissionRuntime> = {};
  for (const id of MISSION_ORDER) {
    missions[id] = {
      id,
      status: id === "c1_lab" ? "available" : "locked",
      stepIndex: 0,
      tasks: {},
      decisions: {},
      variant: "default",
      errors: 0,
      errorKeys: [],
      hintsUsed: 0,
      score: 0,
      attempts: 0,
    };
  }
  const chat: ChatMessage[] = initialChat().map((c) => ({
    id: c.id,
    channel: c.channel,
    from: c.from,
    text: "",
    textKey: c.textKey,
    at: c.at,
    system: c.system,
  }));
  return {
    version: SAVE_VERSION,
    profile,
    booted: true,
    introSeen: false,
    timeMin: 8 * 60 + 42,
    day: 1,
    chapter: 1,
    xp: 0,
    reputation: 50,
    titleKey: "intern",
    skills: {},
    badges: [],
    certificates: [],
    missions,
    mails: initialMails() as Mail[],
    mailRead: [],
    chat,
    chatRead: {},
    notifications: [
      {
        id: "n-welcome",
        severity: "info",
        source: "IT Service Desk",
        title: "Bienvenue chez HORIZON",
        body: "Présentez-vous au service IT dans le canal IT-SUPPORT.",
        at: 8 * 60 + 42,
        read: false,
        kind: "system",
      },
    ],
    world: {
      hosts: seedHosts(),
      dns: DNS_ZONE,
      dhcpRunning: true,
      financeOutage: false,
      intranetUp: true,
      fwRules: seedFwRules(),
      switchPorts: seedSwitchPorts(),
      vhosts: seedVhosts(),
      directory: seedDirectory(),
      tickets: [
        {
          id: "IT-1041",
          severity: "low",
          titleKey: "mailContent.certExpirySubject",
          from: "Soriya Chan (SOC)",
          status: "open",
          createdAt: 8 * 60 + 40,
          noise: true,
        },
      ],
      npc: {
        lena: { id: "lena", mood: "neutral" },
        marie: { id: "marie", mood: "neutral" },
        marc: { id: "marc", mood: "neutral" },
        paul: { id: "paul", mood: "neutral" },
        soriya: { id: "soriya", mood: "neutral" },
        nour: { id: "nour", mood: "neutral" },
        amina: { id: "amina", mood: "neutral" },
        jules: { id: "jules", mood: "neutral" },
      },
    },
    vfs: {},
    terminalHistory: {},
    workspace: createWorkspace(),
    openWindows: [],
    activeWindow: null,
    currentObjective: null,
    pendingDecision: null,
    learning: null,
    debrief: null,
    activeMissionId: null,
    sound: {
      muted: false,
      master: 0.8,
      music: 0.5,
      sfx: 0.7,
      ambient: 0.4,
      mode: "calm",
    },
    completedMissions: [],
    hintsUsedTotal: 0,
    errorsTotal: 0,
    recommendedLabKey: null,
    exploredApps: [],
    toasts: [],
    editorOpen: null,
    lastConsequence: null,
    dossier: [],
    savedAt: 0,
    startedAt: Date.now(),
  };
}

function blankMission(id: string, status: MissionStatus): MissionRuntime {
  return {
    id,
    status,
    stepIndex: 0,
    tasks: {},
    decisions: {},
    variant: "default",
    errors: 0,
    errorKeys: [],
    hintsUsed: 0,
    score: 0,
    attempts: 0,
  };
}

/** Additive: new missions/hosts appear on old saves without wiping progress. */
export function hydrateProgression(state: GameState): GameState {
  const seeded = seedHosts();
  const hosts = { ...seeded, ...(state.world?.hosts ?? {}) };
  for (const [id, seed] of Object.entries(seeded)) {
    const existing = hosts[id];
    if (!existing) {
      hosts[id] = seed;
      continue;
    }
    hosts[id] = {
      ...seed,
      ...existing,
      ifaces: { ...seed.ifaces, ...existing.ifaces },
      wifiAp: existing.wifiAp ?? seed.wifiAp,
      wifiClient: existing.wifiClient ?? seed.wifiClient,
      accounts: existing.accounts ?? seed.accounts,
    };
  }
  const missions = { ...(state.missions ?? {}) };
  for (const id of MISSION_ORDER) {
    if (!missions[id]) missions[id] = blankMission(id, "locked");
  }
  const completed = new Set(state.completedMissions ?? []);
  for (const id of Object.keys(missions)) {
    if (missions[id].status === "completed") completed.add(id);
  }
  for (const id of MISSION_ORDER) {
    const def = MISSIONS[id];
    const rt = missions[id];
    if (rt.status === "locked" && def.prereq.every((p) => completed.has(p))) {
      rt.status = "available";
    }
  }
  const npc = { ...(state.world?.npc ?? {}) };
  if (!npc.nour) npc.nour = { id: "nour", mood: "neutral" };
  if (!npc.amina) npc.amina = { id: "amina", mood: "neutral" };
  if (!npc.jules) npc.jules = { id: "jules", mood: "neutral" };
  const existingRules = state.world?.fwRules;
  let fwRules = Array.isArray(existingRules) ? existingRules : seedFwRules();
  if (!fwRules.some((r) => r.id === "FW-CORE")) {
    fwRules = [...seedFwRules(), ...fwRules];
  }
  const seededPorts = seedSwitchPorts();
  const existingPorts = state.world?.switchPorts;
  let switchPorts = Array.isArray(existingPorts) && existingPorts.length
    ? seededPorts.map((seed) => existingPorts.find((p) => p.id === seed.id) ?? seed)
    : seededPorts;
  let chapter = state.chapter ?? 1;
  if (completed.has("c1_sim")) chapter = Math.max(chapter, 2);
  if (completed.has("c2_sim")) chapter = Math.max(chapter, 3);
  if (completed.has("c3_sim")) chapter = Math.max(chapter, 4);
  if (completed.has("c4_sim")) chapter = Math.max(chapter, 5);
  if (completed.has("c5_sim")) chapter = Math.max(chapter, 6);
  const seededVhosts = seedVhosts();
  const vhosts = { ...seededVhosts, ...(state.world?.vhosts ?? {}) };
  const seededDir = seedDirectory();
  const directory = { ...seededDir, ...(state.world?.directory ?? {}) };
  const dns = { ...DNS_ZONE, ...(state.world?.dns ?? {}) };
  return {
    ...state,
    chapter,
    missions,
    completedMissions: [...completed],
    dossier: Array.isArray(state.dossier) ? state.dossier : [],
    world: {
      ...state.world,
      hosts,
      npc,
      fwRules,
      switchPorts,
      vhosts,
      directory,
      dns,
    },
  };
}

// ---------------- Save migrations (never wipe progress) ----------------
function migrate(doc: SaveDocument): SaveDocument {
  let state = doc.state;
  if (!state.version || state.version < 3) {
    // v1/v2 saves are rebuilt on top of the current world seed while
    // keeping everything the player earned.
    const fresh = createInitialState(state.profile as Profile);
    state = {
      ...fresh,
      ...state,
      world: {
        ...fresh.world,
        ...state.world,
        hosts: { ...fresh.world.hosts, ...state.world?.hosts },
      },
      missions: { ...fresh.missions, ...state.missions },
      version: SAVE_VERSION,
    };
  }
  state = hydrateProgression(state);
  state.version = SAVE_VERSION;
  return { ...doc, state, version: SAVE_VERSION };
}

export function loadLocalSave(): SaveDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as SaveDocument;
    if (!doc.state?.profile) return null;
    return migrate(doc);
  } catch {
    return null;
  }
}

// ============================================================
// Engine
// ============================================================
export class GameEngine {
  state: GameState;
  private listeners = new Set<() => void>();
  private localSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(state: GameState) {
    const hydrated = hydrateProgression(state);
    this.state = {
      ...hydrated,
      workspace: restoreWorkspace(
        hydrated.workspace,
        Object.keys(hydrated.world.hosts)
      ),
    };
  }

  // ---------------- React subscription ----------------
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getState = (): GameState => this.state;

  private bump(): void {
    // Memoized apps need fresh collection references, not a clock tick.
    this.state = {
      ...this.state,
      openWindows: [...this.state.openWindows],
      mails: [...this.state.mails],
      mailRead: [...this.state.mailRead],
      chat: [...this.state.chat],
      notifications: [...this.state.notifications],
      toasts: [...this.state.toasts],
    };
    for (const l of this.listeners) l();
    this.queueLocalSave();
  }

  // ---------------- Durable workspace (never executes restored commands) ----------------
  setWindowLayout(app: AppId, patch: Partial<WindowLayout>): void {
    if (!APP_IDS.includes(app)) return;
    this.state.workspace.windows = {
      ...this.state.workspace.windows,
      [app]: normalizeWindowLayout({ ...(this.state.workspace.windows[app] ?? defaultWindowLayout()), ...patch }),
    };
    this.bump();
  }

  resetWindowLayout(app: AppId): void {
    const windows = { ...this.state.workspace.windows };
    delete windows[app];
    this.state.workspace.windows = windows;
    this.bump();
  }

  selectTerminalHost(hostId: string): void {
    if (!this.state.world.hosts[hostId]) return;
    this.state.workspace.terminal.hostId = hostId;
    this.bump();
  }

  setTerminalDraft(hostId: string, draft: string): void {
    if (!this.state.world.hosts[hostId]) return;
    const terminal = this.state.workspace.terminal;
    const session = terminal.sessions[hostId] ?? { draft: "", blocks: [] };
    terminal.sessions = { ...terminal.sessions, [hostId]: { ...session, draft: draft.slice(0, MAX_TERMINAL_INPUT) } };
    this.bump();
  }

  clearTerminalOutput(hostId: string): void {
    if (!this.state.world.hosts[hostId]) return;
    const terminal = this.state.workspace.terminal;
    const session = terminal.sessions[hostId] ?? { draft: "", blocks: [] };
    terminal.sessions = { ...terminal.sessions, [hostId]: { ...session, blocks: [] } };
    this.bump();
  }

  private recordTerminalOutput(hostId: string, command: string, output: string[], note = false): void {
    const terminal = this.state.workspace.terminal;
    const session = terminal.sessions[hostId] ?? { draft: "", blocks: [] };
    const block: TerminalBlock = { id: uid("output"), command, output, note };
    terminal.sessions = {
      ...terminal.sessions,
      [hostId]: { ...session, blocks: trimTerminalBlocks([...session.blocks, block]) },
    };
  }

  selectChatChannel(channel: string): void {
    if (!CHAT_CHANNELS.some((id) => id === channel)) return;
    this.state.workspace.chat.channel = channel;
    this.bump();
  }

  setChatDraft(channel: string, draft: string): void {
    if (!CHAT_CHANNELS.some((id) => id === channel)) return;
    this.state.workspace.chat.drafts = { ...this.state.workspace.chat.drafts, [channel]: draft.slice(0, 500) };
    this.bump();
  }

  setEditorDraft(hostId: string, path: string, content: string): void {
    const editor = this.state.editorOpen;
    if (!editor || editor.hostId !== hostId || editor.path !== path) return;
    this.state.workspace.editorDraft = { hostId, path, content: content.slice(0, 24000) };
    this.bump();
  }

  // ---------------- i18n ----------------
  get lang(): Lang {
    return this.state.profile?.lang ?? "fr";
  }
  t: TFn = (key, vars) => makeT(this.lang)(key, vars);

  // ---------------- Fx API (used by mission steps) ----------------
  private fx(): FxApi {
    const engine = this;
    return {
      get state() {
        return engine.state;
      },
      notify: (n) => {
        const notif: Notification = {
          id: uid("n"),
          severity: n.severity,
          source: n.source,
          title: n.title ?? (n.titleKey ? engine.t(n.titleKey) : ""),
          body: n.body ?? (n.bodyKey ? engine.t(n.bodyKey) : undefined),
          at: engine.state.timeMin,
          read: false,
          kind: n.kind,
          linkMission: n.linkMission,
        };
        engine.state.notifications.unshift(notif);
        if (engine.state.notifications.length > 30)
          engine.state.notifications.length = 30;
        engine.soundFor(n.severity);
      },
      chat: (channel, from, text, system) => {
        engine.addChat(channel, from, text, system);
      },
      mail: (m) => {
        engine.addMail({
          from: m.from,
          to: m.to ?? "player",
          subjectKey: m.subjectKey,
          bodyKey: m.bodyKey,
          attachments: m.attachments,
          phish: m.phish,
        });
      },
      objective: (key) => {
        engine.state.currentObjective = key;
      },
      awardXp: (n) => {
        engine.state.xp += n;
      },
      awardBadge: (id) => {
        if (!engine.state.badges.includes(id)) {
          engine.state.badges.push(id);
          engine.pushToast({ kind: "success", textKey: `badges.${id}.name` });
          audio.unlock();
        }
      },
      skill: (id, level, xp) => {
        engine.awardSkill(id, level, xp);
      },
      rep: (n) => {
        engine.state.reputation += n;
      },
      hostLog: (hostId, line) => {
        const h = engine.state.world.hosts[hostId];
        if (h) {
          h.logs.push(line);
          if (h.logs.length > 80) h.logs.splice(0, h.logs.length - 80);
        }
      },
      mutateHost: (hostId, fn) => {
        const h = engine.state.world.hosts[hostId];
        if (h) fn(h);
      },
      setDecision: (d) => {
        engine.state.pendingDecision = d;
        if (d.kind === "call") audio.phone();
      },
      setLearning: (l) => {
        engine.state.learning = l;
        audio.error();
      },
      setWorld: (fn) => fn(engine.state.world),
      sound: (s) => {
        if (s === "notify") audio.notify();
        else if (s === "alert") audio.alert();
        else if (s === "success") audio.success();
        else if (s === "error") audio.error();
        else if (s === "phone") audio.phone();
        else if (s === "unlock") audio.unlock();
      },
      t: (key, vars) => engine.t(key, vars),
    };
  }

  private soundFor(severity: Notification["severity"]): void {
    if (severity === "critical" || severity === "high") audio.alert();
    else audio.notify();
  }

  private pushToast(toast: Toast): void {
    toast.id = toast.id ?? uid("toast");
    this.state.toasts.push(toast);
    if (this.state.toasts.length > 4) this.state.toasts.shift();
  }

  // ---------------- Profile / language ----------------
  static bootstrap(profile: Profile): GameEngine {
    return new GameEngine(createInitialState(profile));
  }

  setLang(lang: Lang): void {
    if (!this.state.profile) return;
    this.state.profile.lang = lang;
    this.bump();
    this.save();
  }

  // ---------------- Sound ----------------
  updateSoundMode(): void {
    const s = this.state;
    let mode: GameState["sound"]["mode"] = "calm";
    if (s.world.financeOutage) mode = "crisis";
    else if (s.pendingDecision?.kind === "call") mode = "tense";
    else if (s.activeMissionId && s.missions[s.activeMissionId]?.overtime) mode = "crisis";
    else if (s.activeMissionId && s.missions[s.activeMissionId]?.status === "active")
      mode = s.activeMissionId === "c1_sim" ? "tense" : "investigation";
    else if (s.debrief) mode = "resolved";
    if (mode !== s.sound.mode) {
      s.sound.mode = mode;
      audio.setMode(mode);
    }
  }

  setSound(patch: Partial<GameState["sound"]>): void {
    this.state.sound = { ...this.state.sound, ...patch };
    audio.applySettings(this.state.sound);
    this.bump();
    this.save();
  }

  // ---------------- Apps / windows ----------------
  openApp(app: AppId): void {
    if (!this.state.openWindows.includes(app))
      this.state.openWindows.push(app);
    this.state.activeWindow = app;
    if (!this.state.exploredApps.includes(app)) {
      this.state.exploredApps.push(app);
      if (this.state.exploredApps.length >= 5) this.fx().awardBadge("curious");
    }
    audio.open();
    this.dispatch({ type: "app-opened", app });
  }

  closeWindow(app: AppId): void {
    this.state.openWindows = this.state.openWindows.filter((a) => a !== app);
    if (this.state.activeWindow === app)
      this.state.activeWindow = this.state.openWindows[this.state.openWindows.length - 1] ?? null;
    if (app === "terminal") this.state.editorOpen = null;
    audio.close();
    this.bump();
  }

  focusWindow(app: AppId): void {
    if (!this.state.openWindows.includes(app)) {
      this.openApp(app);
      return;
    }
    if (this.state.activeWindow === app) return;
    this.state.activeWindow = app;
    this.bump();
  }

  minimizeWindow(app: AppId): void {
    if (this.state.activeWindow !== app) return;
    this.state.activeWindow = null;
    this.bump();
  }

  // ---------------- Terminal ----------------
  execTerminal(line: string, hostId: string): string[] {
    const previousHistory = [...(this.state.terminalHistory[hostId] ?? [])];
    const res = execTerminal(line, hostId, this.state, this.t.bind(this));
    const extra: string[] = [];
    const sig = res.signals;
    if (sig.serviceRestart)
      extra.push(...this.applyServiceRestart(hostId, sig.serviceRestart.service));
    if (sig.serviceStop) {
      const h = this.state.world.hosts[hostId];
      if (h) h.services[sig.serviceStop.service] = "inactive";
    }
    if (sig.dhcpRequested) extra.push(...this.applyDhcp(hostId));
    if (sig.netplanApplied) extra.push(...this.applyNetplan(hostId));
    if (sig.linkSet)
      extra.push(...this.applyLinkSet(hostId, sig.linkSet.iface, sig.linkSet.state));
    if (res.openEditor)
      this.state.editorOpen = { hostId, ...res.openEditor };
    if (!sig.clear) {
      (this.state.terminalHistory[hostId] ??= []).push(line);
    }
    const output = line.trim() === "history"
      ? previousHistory.map((cmd, index) => `${String(index + 1).padStart(3, " ")}  ${cmd}`)
      : [...res.output, ...extra];
    if (this.state.world.hosts[hostId]) {
      if (sig.clear) this.clearTerminalOutput(hostId);
      else if (line.trim()) this.recordTerminalOutput(hostId, line, output);
    }
    this.dispatch({ type: "cmd", hostId, argv: sig.argv, line });
    return output;
  }

  writeFile(hostId: string, path: string, content: string): string {
    (this.state.vfs[hostId] ??= {})[path] = content;
    const host = this.state.world.hosts[hostId];
    if (host && path.endsWith("resolv.conf")) {
      const ns = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("nameserver"))
        .map((l) => l.split(/\s+/)[1])
        .filter((s): s is string => !!s && /^\d+\.\d+\.\d+\.\d+$/.test(s));
      if (ns.length) host.dns = ns;
    }
    if (host)
      host.logs.push(
        `Sep 12 ${this.clock()} ${host.id.toLowerCase()} sudo: student edited ${path}`
      );
    this.state.editorOpen = null;
    this.state.workspace.editorDraft = null;
    const message = this.t("terminal.edited", { path });
    this.recordTerminalOutput(hostId, "", [message], true);
    this.dispatch({ type: "file-written", hostId, path });
    return message;
  }

  cancelEdit(): void {
    this.state.editorOpen = null;
    this.state.workspace.editorDraft = null;
    this.bump();
  }

  private clock(): string {
    const t = this.state.timeMin;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  private applyServiceRestart(hostId: string, svc: string): string[] {
    const host = this.state.world.hosts[hostId];
    if (!host) return [];
    host.services[svc] = "active";
    host.logs.push(
      `Sep 12 ${this.clock()} ${hostId.toLowerCase()} systemd[1]: Started ${svc}.service`
    );
    // Consequence engine: restarting the HQ DHCP server while a chapter-1
    // incident is active is a premature action with real blast radius.
    const rt = this.activeRuntime();
    if (
      hostId === "RTR-HQ" &&
      svc === "isc-dhcp-server" &&
      rt &&
      rt.status === "active" &&
      !rt.errorKeys.includes("dhcp_restart")
    ) {
      rt.errors += 1;
      rt.errorKeys.push("dhcp_restart");
      this.state.reputation -= 8;
      this.state.world.financeOutage = true;
      this.state.world.tickets.push(
        {
          id: "IT-1043",
          severity: "critical",
          titleKey: "missions.c1_mission.decConsequenceA",
          from: "Finance (12 postes)",
          status: "open",
          createdAt: this.state.timeMin,
        },
        {
          id: "IT-1044",
          severity: "high",
          titleKey: "missions.c1_mission.decConsequenceA",
          from: "Marc Aubin",
          status: "open",
          createdAt: this.state.timeMin,
        }
      );
      if (rt.id === "c1_sim") {
        this.state.learning = {
          titleKey: "missions.c1_sim.learningTitle",
          impactKey: "missions.c1_sim.learningImpact",
          whyKey: "missions.c1_sim.learningWhy",
          checkKey: "missions.c1_sim.learningCheck",
          causeKey: `missions.c1_sim.cause_${rt.variant}`,
        };
      } else {
        this.state.learning = {
          titleKey: "missions.c1_mission.learningTitle",
          impactKey: "missions.c1_mission.learningImpact",
          whyKey: "missions.c1_mission.learningWhy",
          checkKey: "missions.c1_mission.learningCheck",
        };
      }
      audio.alert();
    }
    return [];
  }

  private applyDhcp(hostId: string): string[] {
    const host = this.state.world.hosts[hostId];
    if (!host) return [this.t("terminal.dhcpFailed")];
    if (!this.state.world.dhcpRunning) return [this.t("terminal.dhcpFailed")];
    if (host.services["systemd-networkd"] !== "active") {
      host.logs.push(
        `Sep 12 ${this.clock()} ${hostId.toLowerCase()} dhclient: networkd not active, aborting`
      );
      return [this.t("terminal.dhcpFailed")];
    }
    const lease = DHCP_LEASES[hostId];
    if (!lease) return [this.t("terminal.dhcpFailed")];
    const [ip, cidr, gw] = lease;
    host.ifaces.eth0.ip = ip;
    host.ifaces.eth0.cidr = cidr;
    host.ifaces.eth0.gw = gw;
    host.logs.push(
      `Sep 12 ${this.clock()} ${hostId.toLowerCase()} dhclient: DHCPACK from ${gw} (${ip})`
    );
    return [this.t("terminal.dhcpLease", { ip, cidr, gw })];
  }

  private applyNetplan(hostId: string): string[] {
    const host = this.state.world.hosts[hostId];
    if (!host) return [this.t("terminal.netplanApplied")];
    const path = host.netplanPath ?? "/etc/netplan/01-netcfg.yaml";
    const content = this.state.vfs[hostId]?.[path];
    if (!content) {
      host.logs.push(
        `Sep 12 ${this.clock()} ${hostId.toLowerCase()} systemd-networkd: configuration unchanged`
      );
      return [this.t("terminal.netplanApplied")];
    }
    const parsed = parseNetplan(content);
    if (!parsed.iface) {
      const rt = this.activeRuntime();
      if (rt && rt.status === "active" && !rt.errorKeys.includes("bad_netplan")) {
        rt.errors += 1;
        rt.errorKeys.push("bad_netplan");
        this.state.learning = {
          titleKey: "missions.c1_sim.learningTitle",
          impactKey: "missions.c1_sim.learningImpact",
          whyKey: "missions.c1_sim.learningWhy",
          checkKey: "missions.c1_sim.learningCheck",
        };
      }
      return ["netplan: configuration invalide — aucune interface trouvée."];
    }
    const iface = host.ifaces[parsed.iface];
    if (iface) {
      if (parsed.dhcp !== undefined) iface.dhcp = parsed.dhcp;
      if (parsed.ip) {
        iface.ip = parsed.ip;
        iface.cidr = parsed.cidr ?? 24;
      }
      if (parsed.gw) iface.gw = parsed.gw;
    }
    if (parsed.dns && parsed.dns.length) host.dns = parsed.dns;
    host.logs.push(
      `Sep 12 ${this.clock()} ${hostId.toLowerCase()} systemd-networkd: config reappliee (netplan)`
    );
    return [this.t("terminal.netplanApplied")];
  }

  private applyLinkSet(hostId: string, ifaceName: string, st: "up" | "down"): string[] {
    const host = this.state.world.hosts[hostId];
    if (!host) return [];
    const i = host.ifaces[ifaceName];
    if (i) {
      i.state = st;
      host.logs.push(
        `Sep 12 ${this.clock()} ${hostId.toLowerCase()} kernel: ${ifaceName}: link ${st}`
      );
    }
    return [];
  }

  // ---------------- Mail / Chat / Notifications ----------------
  private addMail(m: Omit<Mail, "id" | "at">): void {
    this.state.mails.unshift({ ...m, id: uid("mail"), at: this.state.timeMin });
  }

  readMail(id: string): void {
    if (!this.state.mailRead.includes(id)) this.state.mailRead.push(id);
    this.dispatch({ type: "mail-read", mailId: id });
  }

  /** Generic action event (labs, calculators, custom interactions). */
  dispatchAction(action: string, payload?: Record<string, unknown>): void {
    this.dispatch({ type: "action", action, payload });
  }

  private addChat(channel: string, from: string, text: string, system?: boolean): void {
    const msg: ChatMessage = {
      id: uid("c"),
      channel,
      from,
      at: this.state.timeMin,
      system,
    };
    // A dict key has no spaces and contains dots; resolved text has spaces.
    if (/^[\w.]+$/.test(text) && text.includes(".")) {
      msg.textKey = text;
      msg.text = "";
    } else {
      msg.text = text;
    }
    this.state.chat.push(msg);
    this.state.chatRead[channel] = Date.now();
  }

  sendChat(channel: string, text: string): void {
    this.state.chat.push({
      id: uid("c"),
      channel,
      from: "player",
      text,
      at: this.state.timeMin,
    });
    this.state.chatRead[channel] = Date.now();
    audio.key();
    this.dispatch({ type: "chat-sent", channel, text });
    // Generic NPC reply when no mission is driving the conversation.
    const rt = this.activeRuntime();
    if (!rt || rt.status !== "active" || this.state.activeMissionId === "c1_lab") {
      const replies: Record<string, string> = {
        itsupport: "Bien noté. Je regarde ça.",
        soc: "Bien reçu. On surveille les alertes.",
        general: "Bienvenue chez HORIZON !",
      };
      setTimeout(() => {
        this.addChat(channel, "lena", replies[channel] ?? "OK.");
        audio.notify();
        this.bump();
      }, 2200);
    }
  }

  markAllNotificationsRead(): void {
    this.state.notifications.forEach((n) => (n.read = true));
    this.bump();
  }

  closeTicket(id: string): void {
    const t = this.state.world.tickets.find((x) => x.id === id);
    if (t) {
      t.status = "closed";
      this.pushToast({ kind: "success", text: `${id} clos` });
      this.bump();
    }
  }

  dismissToast(id: string): void {
    if (!this.state.toasts.some((toast) => toast.id === id)) return;
    this.state.toasts = this.state.toasts.filter((toast) => toast.id !== id);
    this.bump();
  }

  dismissNotification(id: string): void {
    this.state.notifications = this.state.notifications.filter((n) => n.id !== id);
    this.bump();
  }

  // ---------------- Mission lifecycle ----------------
  private activeRuntime(): MissionRuntime | null {
    const id = this.state.activeMissionId;
    return id ? (this.state.missions[id] ?? null) : null;
  }

  startMission(id: string, forcedVariant?: string): void {
    this.state = hydrateProgression(this.state);
    const def = getMission(id);
    if (!def) return;
    if (!this.state.missions[id]) {
      this.state.missions[id] = blankMission(id, "locked");
      this.state = hydrateProgression(this.state);
    }
    const rt = this.state.missions[id];
    if (!rt || rt.status === "locked") {
      this.pushToast({ kind: "error", textKey: "academy.prereqMissing" });
      this.bump();
      return;
    }
    if (rt.status === "active") {
      this.openMissionWorkspace(def);
      return;
    }
    rt.status = "active";
    rt.attempts += 1;
    rt.errors = 0;
    rt.errorKeys = [];
    rt.hintsUsed = 0;
    rt.score = 0;
    rt.stepIndex = 0;
    rt.tasks = {};
    for (const step of def.steps) {
      for (const t of step.tasks ?? []) rt.tasks[t.id] = { done: false };
    }
    const pool = def.variants?.length ? def.variants : ["default"];
    rt.variant =
      forcedVariant ??
      (def.hasVariants ? pool[Math.floor(Math.random() * pool.length)] : "default");
    rt.startedAt = Date.now();
    rt.deadlineMin = this.state.timeMin + Math.max(4, def.estimateMin);
    rt.overtime = false;
    this.state.activeMissionId = id;
    this.state.debrief = null;
    this.state.learning = null;
    this.state.pendingDecision = null;
    this.state.currentObjective = def.briefKey;
    def.onStart?.(this.fx(), this.state, rt.variant);
    this.enterStep(def, 0);
    this.openMissionWorkspace(def);
    this.dispatch({ type: "mission-start", missionId: id });
    this.bump();
    this.save();
  }

  private openMissionWorkspace(def: MissionDef): void {
    if (def.id === "c2_lab") {
      this.openApp("network");
      return;
    }
    if (def.id === "c5_web" || def.id === "c5_sim") {
      this.openApp("mail");
      this.openApp("browser");
      this.openApp("terminal");
      this.focusWindow("mail");
      return;
    }
    if (def.kind === "lab") {
      this.openApp("terminal");
      return;
    }
    this.openApp("mail");
    this.openApp("chat");
    this.openApp("terminal");
    this.focusWindow("mail");
  }

  private enterStep(def: MissionDef, index: number): void {
    const rt = this.state.missions[def.id];
    if (index >= def.steps.length) {
      this.completeMission(def);
      return;
    }
    rt.stepIndex = index;
    const step = def.steps[index];
    if (step.objectiveKey) this.state.currentObjective = step.objectiveKey;
    if (step.type === "decision" && step.decision) {
      this.state.pendingDecision = step.decision;
      if (step.decision.kind === "call") audio.phone();
    }
    step.enter?.(this.fx(), this.state, rt.variant);
    if (step.type === "brief") {
      this.enterStep(def, index + 1);
      return;
    }
    if (step.type === "final") {
      this.completeMission(def);
    }
  }

  private dispatch(event: EngineEvent): void {
    const rt = this.activeRuntime();
    if (!rt || rt.status !== "active") {
      this.updateSoundMode();
      this.bump();
      return;
    }
    const def = getMission(rt.id);
    if (!def) return;
    const step = def.steps[rt.stepIndex];
    if (step?.type === "tasks" && step.handle) {
      const dir = step.handle({
        fx: this.fx(),
        state: this.state,
        mission: rt,
        step,
        event,
      });
      if (dir) {
        const realTaskIds = new Set((step.tasks ?? []).map((t) => t.id));
        for (const tid of dir.doneTasks ?? []) {
          const already = rt.tasks[tid]?.done;
          rt.tasks[tid] = { done: true };
          if (already) continue;
          // Only real tasks grant XP and toasts; helper markers are silent.
          if (realTaskIds.has(tid)) {
            this.state.xp += 5;
            const def2 = step.tasks?.find((t) => t.id === tid);
            if (def2)
              this.pushToast({ kind: "success", textKey: def2.labelKey });
          }
        }
        if (dir.complete) {
          this.enterStep(def, rt.stepIndex + 1);
        }
      }
    }
    this.updateSoundMode();
    this.bump();
  }

  answerDecision(choiceId: string): void {
    const d = this.state.pendingDecision;
    if (!d) return;
    const option: DecisionOption | undefined = d.options.find(
      (o) => o.id === choiceId
    );
    if (!option) return;
    const rt = this.activeRuntime();
    if (rt) rt.decisions[d.id] = choiceId;
    if (option.rep) this.state.reputation += option.rep;
    option.fx?.(this.fx(), this.state);
    this.state.lastConsequence = {
      id: d.id,
      textKey: option.consequenceKey,
      positive: !!option.correct,
    };
    if (rt) {
      this.recordCareer({
        kind: option.correct ? "decision" : "error",
        missionId: rt.id,
        decisionId: d.id,
        choiceId: choiceId,
        labelKey: option.labelKey,
        consequenceKey: option.consequenceKey,
        positive: !!option.correct,
        repDelta: option.rep,
      });
    }
    if (option.correct) audio.success();
    else audio.error();
    const def = rt ? getMission(rt.id) : undefined;
    const wasDecisionStep = def && rt && def.steps[rt.stepIndex]?.type === "decision";
    this.state.pendingDecision = null;
    if (wasDecisionStep && def) this.enterStep(def, rt.stepIndex + 1);
    this.bump();
    this.save();
  }

  useHint(): void {
    const rt = this.activeRuntime();
    if (!rt) return;
    rt.hintsUsed += 1;
    this.state.hintsUsedTotal += 1;
    this.bump();
  }

  closeLearning(): void {
    this.state.learning = null;
    this.bump();
  }

  markIntroSeen(): void {
    this.state.introSeen = true;
    this.state.currentObjective = null;
    this.bump();
    this.save();
  }

  closeDebrief(): void {
    this.state.debrief = null;
    this.state.currentObjective = null;
    this.bump();
    this.save();
  }

  private completeMission(def: MissionDef): void {
    const rt = this.state.missions[def.id];
    if (rt.status === "completed") return;
    rt.status = "completed";
    rt.completedAt = Date.now();
    rt.score = Math.max(
      50,
      100 - rt.errors * 12 - rt.hintsUsed * 8
    );
    rt.bestScore = Math.max(rt.bestScore ?? 0, rt.score);
    if (!this.state.completedMissions.includes(def.id))
      this.state.completedMissions.push(def.id);

    // Debrief
    if (def.debrief) {
      this.state.debrief = def.debrief(this.state, rt, this.t.bind(this));
    } else {
      this.state.debrief = {
        missionId: def.id,
        titleKey: def.titleKey,
        outcome: rt.errors ? "partial" : "success",
        score: rt.score,
        maxScore: 100,
        errors: [],
        skillsValidated: def.skillIds.map((id) => ({
          id,
          level: "practice" as SkillLevel,
        })),
        skillsToReview: [],
        methodKey: "",
        nextStepKey: "",
        report: `${def.id} — ${rt.score}/100`,
      };
    }

    // Certificates
    for (const certDef of CERTIFICATES) {
      if (
        certDef.missionIds.every((m) => this.state.completedMissions.includes(m)) &&
        !this.state.certificates.some((c) => c.titleKey === certDef.titleKey)
      ) {
        this.issueCertificate(certDef, rt.score);
      }
    }

    // Title progression (skills-driven, XP is not enough)
    this.state.titleKey = computeTitle(this.state.xp, this.state.skills);

    // Unlocks
    for (const m of MISSION_ORDER) {
      const mDef = MISSIONS[m];
      const mRt = this.state.missions[m];
      if (mRt?.status === "locked" && mDef.prereq.every((p) => this.state.completedMissions.includes(p))) {
        mRt.status = "available";
        this.pushToast({ kind: "info", textKey: "notifyContent.missionReady" });
        audio.unlock();
      }
    }

    // Chapter progression
    if (this.state.completedMissions.includes("c1_sim")) this.state.chapter = Math.max(this.state.chapter, 2);
    if (this.state.completedMissions.includes("c2_sim")) this.state.chapter = Math.max(this.state.chapter, 3);
    if (this.state.completedMissions.includes("c3_sim")) this.state.chapter = Math.max(this.state.chapter, 4);
    if (this.state.completedMissions.includes("c4_sim")) this.state.chapter = Math.max(this.state.chapter, 5);
    if (this.state.completedMissions.includes("c5_sim")) this.state.chapter = Math.max(this.state.chapter, 6);

    this.recomputeRecommendation();
    this.state.activeMissionId = null;
    this.updateSoundMode();
    this.save();
  }

  private issueCertificate(certDef: (typeof CERTIFICATES)[number], score: number): void {
    const skills = certDef.skills.map((id) => {
      const def = SKILLS.find((s) => s.id === id);
      const st = this.state.skills[id];
      return {
        id,
        label: def?.label[this.lang] ?? id,
        level: st?.level ?? ("practice" as SkillLevel),
      };
    });
    const cert: Certificate = {
      id: certId(),
      holderName: this.state.profile?.name ?? "Anonymous",
      titleKey: certDef.titleKey,
      level: certDef.level,
      skills,
      score,
      issuedAt: Date.now(),
    };
    this.state.certificates.push(cert);
    // Server-side persistence for the public verification page.
    fetch("/api/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: cert.id,
        profileId: this.state.profile?.name ?? "anonymous",
        holderName: cert.holderName,
        titleKey: cert.titleKey,
        level: cert.level,
        skills: cert.skills,
        score: cert.score,
      }),
    }).catch(() => undefined);
  }

  // ---------------- Skills ----------------
  private awardSkill(id: string, level: SkillLevel, xp = 0): void {
    const cur = this.state.skills[id];
    if (!cur) {
      this.state.skills[id] = { level, xp, attempts: 1, successes: 1 };
    } else {
      cur.xp += xp;
      cur.attempts += 1;
      if (levelIndex(level) >= levelIndex("practice")) cur.successes += 1;
      if (levelIndex(level) > levelIndex(cur.level)) cur.level = level;
    }
    this.state.titleKey = computeTitle(this.state.xp, this.state.skills);
  }

  private recomputeRecommendation(): void {
    const s = this.state.skills;
    const sim = this.state.missions["c1_sim"];
    if (sim?.errorKeys.includes("dhcp_restart") || sim?.errorKeys.includes("bad_netplan")) {
      this.state.recommendedLabKey = "rec.method";
    } else if (s["dns"] && levelIndex(s["dns"].level) < levelIndex("practice")) {
      this.state.recommendedLabKey = "rec.dns";
    } else if (s["dhcp"] && levelIndex(s["dhcp"].level) < levelIndex("practice")) {
      this.state.recommendedLabKey = "rec.dhcp";
    } else {
      this.state.recommendedLabKey = "rec.generic";
    }
  }

  // ---------------- Time ----------------
  tick(): void {
    this.state.timeMin += 1;
    if (this.state.timeMin >= 24 * 60) {
      this.state.timeMin -= 24 * 60;
      this.state.day += 1;
    }
    this.checkDeadline();
    // Rare ambient life: optional notifications / distractions.
    if (Math.random() < 0.04 && this.state.notifications.length < 25) {
      const pool = [
        {
          severity: "low" as const,
          source: "SOC",
          titleKey: "notifyContent.socAlert",
        },
        {
          severity: "low" as const,
          source: "IT",
          titleKey: "notifyContent.backupFail",
        },
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.fx().notify({ ...pick, kind: "soc" });
    }
    this.dispatch({ type: "tick" });
  }

  private checkDeadline(): void {
    const rt = this.activeRuntime();
    if (!rt || rt.status !== "active" || rt.deadlineMin == null) return;
    if (this.state.timeMin < rt.deadlineMin || rt.overtime) return;
    rt.overtime = true;
    if (!rt.errorKeys.includes("overtime")) {
      rt.errors += 1;
      rt.errorKeys.push("overtime");
    }
    this.state.reputation = Math.max(0, this.state.reputation - 4);
    this.recordCareer({
      kind: "overtime",
      missionId: rt.id,
      labelKey: "dossier.overtime",
      positive: false,
      repDelta: -4,
    });
    this.fx().notify({
      severity: "high",
      source: "IT Service Desk",
      titleKey: "notifyContent.overtime",
      kind: "it",
      linkMission: rt.id,
    });
    this.fx().chat("itsupport", "lena", this.t("dossier.overtimeChat"));
    this.pushToast({ kind: "consequence", textKey: "hud.overtime", positive: false });
    audio.alert();
  }

  private recordCareer(entry: Omit<CareerEntry, "id" | "at" | "day">): void {
    const row: CareerEntry = {
      ...entry,
      id: uid("cv"),
      at: this.state.timeMin,
      day: this.state.day,
    };
    this.state.dossier = [row, ...(this.state.dossier ?? [])].slice(0, 80);
  }

  /** Minutes left on the active mission SLA (negative when overtime). */
  remainingMin(): number | null {
    const rt = this.activeRuntime();
    if (!rt || rt.status !== "active" || rt.deadlineMin == null) return null;
    return rt.deadlineMin - this.state.timeMin;
  }

  // ---------------- Save ----------------
  private queueLocalSave(): void {
    if (typeof window === "undefined") return;
    if (this.localSaveTimer) clearTimeout(this.localSaveTimer);
    this.localSaveTimer = setTimeout(() => {
      this.localSaveTimer = null;
      this.saveLocally();
    }, 180);
  }

  /** Called synchronously on pagehide as well as before remote saves. */
  private saveLocally(): boolean {
    if (typeof localStorage === "undefined") return false;
    this.state.savedAt = Date.now();
    try {
      const doc: SaveDocument = { version: SAVE_VERSION, savedAt: this.state.savedAt, state: this.state };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(doc));
      return true;
    } catch {
      return false;
    }
  }

  async save(): Promise<SaveOutcome> {
    if (this.localSaveTimer) { clearTimeout(this.localSaveTimer); this.localSaveTimer = null; }
    const local = this.saveLocally();
    const savedAt = this.state.savedAt;
    if (typeof window === "undefined") return { local, remote: false, savedAt };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const body = JSON.stringify({ profile: this.state.profile, state: this.state });
      const response = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
        keepalive: new Blob([body]).size < 60000,
      });
      const result = response.ok ? await response.json() : null;
      return { local, remote: result?.ok === true, savedAt };
    } catch {
      return { local, remote: false, savedAt };
    } finally {
      clearTimeout(timeout);
    }
  }

  async reset(): Promise<void> {
    if (this.localSaveTimer) { clearTimeout(this.localSaveTimer); this.localSaveTimer = null; }
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {
      /* ignore */
    }
    this.state = createInitialState({
      name: this.state.profile?.name ?? "Player",
      avatar: "a1",
      lang: this.state.profile?.lang ?? "fr",
      createdAt: Date.now(),
    });
    this.bump();
  }
}

// ---------------- Global accessor (single tab-wide engine) ----------------
let engine: GameEngine | null = null;

export function getEngine(): GameEngine | null {
  return engine;
}

export function setEngine(e: GameEngine | null): GameEngine | null {
  engine = e;
  return e;
}
