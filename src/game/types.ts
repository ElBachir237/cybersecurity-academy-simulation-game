// ============================================================
// HORIZON CYBER ACADEMY — Core game types
// Strongly-typed contracts shared by the engine, the terminal
// simulator, the mission system and the React UI.
// ============================================================

import type { TFn } from "./i18n";
import type { WorkspaceState } from "./workspace";

export type Lang = "fr" | "en";

export type SkillLevel =
  | "discovery"
  | "learning"
  | "practice"
  | "competent"
  | "proficient"
  | "mastered";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type AppId =
  | "mail"
  | "chat"
  | "terminal"
  | "browser"
  | "network"
  | "soc"
  | "files"
  | "tickets"
  | "academy"
  | "skills"
  | "portfolio";

// ---------------- Profile ----------------
export interface Profile {
  name: string;
  avatar: string; // avatar style id
  lang: Lang;
  createdAt: number;
}

// ---------------- Skills ----------------
export interface SkillState {
  level: SkillLevel;
  xp: number;
  attempts: number;
  successes: number;
}

// ---------------- World ----------------
export interface IfaceRuntime {
  state: "up" | "down";
  dhcp: boolean;
  ip?: string;
  cidr?: number;
  gw?: string;
}

export interface HostRuntime {
  id: string;
  ifaces: Record<string, IfaceRuntime>;
  dns: string[];
  services: Record<string, "active" | "inactive" | "failed">;
  netplanPath?: string;
  logs: string[];
  label: string;
  os: string;
  room: string;
}

export interface Ticket {
  id: string;
  severity: Severity;
  titleKey: string;
  from: string;
  status: "open" | "in_progress" | "closed";
  createdAt: number;
  relatedHost?: string;
  noise?: boolean;
}

export interface NpcState {
  id: string;
  mood: "neutral" | "happy" | "annoyed" | "worried";
}

export interface GameWorld {
  hosts: Record<string, HostRuntime>;
  dns: Record<string, string>; // name -> ip
  dhcpRunning: boolean;
  financeOutage: boolean;
  intranetUp: boolean;
  tickets: Ticket[];
  npc: Record<string, NpcState>;
}

// ---------------- Mail / Chat / Notifications ----------------
export interface Mail {
  id: string;
  from: string;
  to: string;
  subjectKey: string;
  bodyKey: string;
  attachments?: { name: string; kind: "log" | "doc" | "screenshot" }[];
  phish?: boolean;
  at: number;
}

export interface ChatMessage {
  id: string;
  channel: string;
  from: string;
  text?: string; // raw text (already localized when sent)
  textKey?: string; // when present, rendered via t() (language-switch safe)
  at: number;
  system?: boolean;
}

export interface Toast {
  id?: string;
  kind: "info" | "success" | "error" | "consequence";
  text?: string;
  textKey?: string;
  positive?: boolean;
}

export interface EditorOpen {
  hostId: string;
  path: string;
  content: string;
}

export interface Notification {
  id: string;
  severity: Severity;
  source: string;
  title: string;
  body?: string;
  at: number;
  read: boolean;
  kind: "soc" | "it" | "mail" | "chat" | "system" | "phone" | "cert";
  linkMission?: string;
}

// ---------------- Missions ----------------
export type MissionStatus =
  | "locked"
  | "available"
  | "active"
  | "completed";

export interface MissionRuntime {
  id: string;
  status: MissionStatus;
  stepIndex: number;
  tasks: Record<string, { done: boolean }>;
  decisions: Record<string, string>;
  variant: string;
  errors: number;
  errorKeys: string[];
  hintsUsed: number;
  score: number;
  startedAt?: number;
  completedAt?: number;
  bestScore?: number;
  attempts: number;
}

export interface DecisionOption {
  id: string;
  labelKey: string;
  correct?: boolean;
  consequenceKey: string;
  whyKey: string;
  rep?: number;
  fx?: (fx: FxApi, state: GameState) => void;
}

export interface DecisionDef {
  id: string;
  kind: "decision" | "call";
  speaker?: string;
  contextKey: string;
  questionKey: string;
  options: DecisionOption[];
}

export interface LearningModal {
  titleKey: string;
  impactKey?: string;
  whyKey: string;
  checkKey: string;
  causeKey?: string;
}

export interface EngineEvent {
  type:
    | "cmd"
    | "file-written"
    | "chat-sent"
    | "mail-read"
    | "app-opened"
    | "decision"
    | "mission-start"
    | "action"
    | "tick";
  hostId?: string;
  argv?: string[];
  line?: string;
  channel?: string;
  text?: string;
  mailId?: string;
  app?: AppId;
  path?: string;
  missionId?: string;
  stepId?: string;
  choiceId?: string;
  action?: string;
  payload?: Record<string, unknown>;
}

export interface TaskDef {
  id: string;
  labelKey: string;
  hintKey?: string;
}

export interface FxApi {
  state: GameState;
  notify: (n: {
    severity: Severity;
    source: string;
    titleKey?: string;
    title?: string;
    bodyKey?: string;
    body?: string;
    kind: Notification["kind"];
    linkMission?: string;
  }) => void;
  chat: (channel: string, from: string, text: string, system?: boolean) => void;
  mail: (m: {
    from: string;
    to?: string;
    subjectKey: string;
    bodyKey: string;
    attachments?: Mail["attachments"];
    phish?: boolean;
  }) => void;
  objective: (key: string) => void;
  awardXp: (n: number) => void;
  awardBadge: (id: string) => void;
  skill: (id: string, level: SkillLevel, xp?: number) => void;
  rep: (n: number) => void;
  hostLog: (hostId: string, line: string) => void;
  mutateHost: (hostId: string, fn: (h: HostRuntime) => void) => void;
  setDecision: (d: DecisionDef) => void;
  setLearning: (l: LearningModal) => void;
  setWorld: (fn: (w: GameWorld) => void) => void;
  sound: (s: "notify" | "alert" | "success" | "error" | "phone" | "unlock") => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export interface StepCtx {
  fx: FxApi;
  state: GameState;
  mission: MissionRuntime;
  step: MissionStepDef;
  event: EngineEvent;
}

export interface StepDirectives {
  doneTasks?: string[];
  complete?: boolean;
  score?: number;
}

export interface MissionStepDef {
  id: string;
  type: "brief" | "tasks" | "decision" | "final";
  objectiveKey?: string;
  tasks?: TaskDef[];
  decision?: DecisionDef;
  enter?: (fx: FxApi, state: GameState, variant: string) => void;
  handle?: (ctx: StepCtx) => StepDirectives | void;
  next?: string;
}

export interface MissionDef {
  id: string;
  chapter: number;
  kind: "lab" | "mission" | "simulation" | "exam";
  skillIds: string[];
  prereq: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  hasVariants: boolean;
  estimateMin: number;
  titleKey: string;
  briefKey: string;
  steps: MissionStepDef[];
  onStart?: (fx: FxApi, state: GameState, variant: string) => void;
  debrief?: (
    state: GameState,
    mission: MissionRuntime,
    t: TFn
  ) => DebriefData;
}

// ---------------- Debrief / Certificates / Badges ----------------
export interface DebriefData {
  missionId: string;
  titleKey: string;
  outcome: "success" | "partial";
  score: number;
  maxScore: number;
  errors: { whatKey: string; whyKey: string }[];
  skillsValidated: { id: string; level: SkillLevel }[];
  skillsToReview: string[];
  methodKey: string;
  nextStepKey: string;
  report: string;
}

export interface Certificate {
  id: string;
  holderName: string;
  titleKey: string;
  level: string;
  skills: { id: string; label: string; level: SkillLevel }[];
  score: number;
  issuedAt: number;
}

// ---------------- Full state ----------------
export interface SoundSettings {
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
  ambient: number;
  mode: "calm" | "tense" | "investigation" | "crisis" | "resolved";
}

export interface GameState {
  version: number;
  profile: Profile | null;
  booted: boolean;
  introSeen: boolean;
  timeMin: number; // minutes since 08:00 day 1
  day: number;
  chapter: number;
  xp: number;
  reputation: number;
  titleKey: string;
  skills: Record<string, SkillState>;
  badges: string[];
  certificates: Certificate[];
  missions: Record<string, MissionRuntime>;
  mails: Mail[];
  mailRead: string[];
  chat: ChatMessage[];
  chatRead: Record<string, number>;
  notifications: Notification[];
  world: GameWorld;
  vfs: Record<string, Record<string, string>>; // host -> path -> content
  terminalHistory: Record<string, string[]>;
  workspace: WorkspaceState;
  openWindows: AppId[];
  activeWindow: AppId | null;
  currentObjective: string | null;
  pendingDecision: DecisionDef | null;
  learning: LearningModal | null;
  debrief: DebriefData | null;
  activeMissionId: string | null;
  sound: SoundSettings;
  completedMissions: string[];
  hintsUsedTotal: number;
  errorsTotal: number;
  recommendedLabKey: string | null;
  exploredApps: AppId[];
  toasts: Toast[];
  editorOpen: EditorOpen | null;
  lastConsequence: { id: string; textKey?: string; text?: string; positive: boolean } | null;
  savedAt: number;
  startedAt: number;
}

// ---------------- Save document ----------------
export interface SaveDocument {
  version: number;
  savedAt: number;
  state: GameState;
}
