import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  serial,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  avatar: text("avatar").notNull(),
  lang: text("lang").notNull().default("fr"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at"),
});

export const saves = pgTable("saves", {
  profileId: text("profile_id")
    .primaryKey()
    .references(() => profiles.id),
  version: integer("version").notNull(),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id"),
  kind: text("kind").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
