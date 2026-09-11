import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  serial,
  boolean,
} from "drizzle-orm/pg-core";

// ============================================================
// Profiles — Accounts & metadata
// ============================================================
export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  lang: text("lang").notNull().default("fr"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at"),
  email: text("email").unique(), // For auth (future)
  verified: boolean("verified").default(false),
});

// ============================================================
// Saves — Full game state (JSON blob)
// ============================================================
export const saves = pgTable("saves", {
  profileId: text("profile_id")
    .primaryKey()
    .references(() => profiles.id),
  version: integer("version").notNull(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================
// Certificates — Verifiable credentials
// ============================================================
export const certificates = pgTable("certificates", {
  id: text("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  holderName: text("holder_name").notNull(),
  titleKey: text("title_key").notNull(),
  level: text("level").notNull(),
  skills: jsonb("skills").notNull(),
  score: integer("score").notNull(),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});

// ============================================================
// Mission Runs — Detailed mission analytics
// ============================================================
export const missionRuns = pgTable("mission_runs", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id),
  missionId: text("mission_id").notNull(),
  variant: text("variant").notNull().default("default"),
  status: text("status").notNull(), // completed, failed, active, locked
  score: integer("score"),
  errors: integer("errors").default(0),
  hintsUsed: integer("hints_used").default(0),
  attempts: integer("attempts").default(1),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// ============================================================
// Decisions — Career dossier entries
// ============================================================
export const decisions = pgTable("decisions", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id),
  missionId: text("mission_id"),
  decisionId: text("decision_id").notNull(),
  choiceId: text("choice_id").notNull(),
  labelKey: text("label_key"),
  consequenceKey: text("consequence_key"),
  positive: boolean("positive"),
  repDelta: integer("rep_delta").default(0),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  day: integer("day"),
  timeMin: integer("time_min"),
});

// ============================================================
// Analytics Events — Gameplay tracking (optional)
// ============================================================
export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id").references(() => profiles.id),
  kind: text("kind").notNull(), // cmd, decision, missionStart, missionComplete, etc.
  missionId: text("mission_id"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================
// Game Events — Replay / audit log (optional)
// ============================================================
export const gameEvents = pgTable("game_events", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id),
  missionId: text("mission_id"),
  type: text("type").notNull(), // cmd, mailRead, chatSent, decisionMade
  hostId: text("host_id"),
  command: text("command"),
  output: jsonb("output"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});