"use client";

// ============================================================
// HORIZON OS — Files, Tickets, Browser, Skills, Portfolio
// ============================================================

import { useMemo, useState } from "react";
import { useGame } from "../context";
import {
  Icon,
  Pill,
  Progress,
  SeverityDot,
  LEVEL_COLOR,
  fmtClock,
  Modal,
  Avatar,
} from "../ui";
import { INTERNAL_SITES } from "@/game/data/world";
import { readHostFile } from "@/game/terminal";
import { TRACKS, SKILLS, BADGES, TITLES } from "@/game/data/curriculum";
import type { Certificate } from "@/game/types";

// ============================== FILES ==============================
const FILE_TREE: Record<string, { name: string; kind: string; path: string }[]> = {
  "/": [
    { name: "home", kind: "dir", path: "/home" },
    { name: "etc", kind: "dir", path: "/etc" },
    { name: "var", kind: "dir", path: "/var" },
  ],
  "/home": [{ name: "student", kind: "dir", path: "/home/student" }],
  "/home/student": [
    { name: "README.txt", kind: "doc", path: "/home/student/README.txt" },
    { name: "notes.txt", kind: "doc", path: "/home/student/notes.txt" },
  ],
  "/etc": [
    { name: "hostname", kind: "config", path: "/etc/hostname" },
    { name: "hosts", kind: "config", path: "/etc/hosts" },
    { name: "resolv.conf", kind: "config", path: "/etc/resolv.conf" },
    { name: "os-release", kind: "config", path: "/etc/os-release" },
    { name: "netplan", kind: "dir", path: "/etc/netplan" },
  ],
  "/etc/netplan": [{ name: "01-netcfg.yaml", kind: "config", path: "/etc/netplan/01-netcfg.yaml" }],
  "/var": [{ name: "log", kind: "dir", path: "/var/log" }],
  "/var/log": [{ name: "syslog", kind: "log", path: "/var/log/syslog" }],
};

export function FilesApp() {
  const { state, t } = useGame();
  const [hostId, setHostId] = useState("WS-001");
  const [cwd, setCwd] = useState("/home/student");
  const [file, setFile] = useState<string | null>(null);

  const host = state.world.hosts[hostId];
  const items = FILE_TREE[cwd] ?? [];
  const content = file && host ? readHostFile(file, host, state) : null;

  return (
    <div className="hz-files-layout">
      <div className="hz-files-sidebar">
        <select
          value={hostId}
          onChange={(e) => setHostId(e.target.value)}
          className="hz-input mb-2 py-1.5 text-[12px]"
        >
          {Object.values(state.world.hosts).map((h) => (
            <option key={h.id} value={h.id}>
              {h.id}
            </option>
          ))}
        </select>
        <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-hz-muted">
          {t("files.root")}
        </p>
        {[
          { p: "/home/student", label: "student/" },
          { p: "/etc", label: "etc/" },
          { p: "/var/log", label: "var/log/" },
        ].map((d) => (
          <button
            key={d.p}
            onClick={() => {
              setCwd(d.p);
              setFile(null);
            }}
            className={`rounded-lg px-2 py-1.5 text-left font-mono text-[12px] ${
              cwd === d.p ? "bg-hz-accent/15 text-hz-accent" : "text-hz-text/80 hover:bg-hz-panel2"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] text-hz-muted">
          <Icon name="folderOpen" size={14} />
          <span className="font-mono">{cwd}</span>
          <span className="ml-auto">{hostId}</span>
        </div>
        <div className="space-y-1">
          {items.map((it) => (
            <button
              key={it.path}
              onClick={() => {
                if (it.kind === "dir") {
                  setCwd(it.path);
                  setFile(null);
                } else {
                  setFile(it.path);
                }
              }}
              className="flex w-full items-center gap-2.5 rounded-lg border border-hz-border px-3 py-2 text-left transition-colors hover:bg-hz-panel2"
            >
              <Icon
                name={it.kind === "dir" ? "folderOpen" : it.kind === "log" ? "scroll" : "file"}
                size={15}
                className={it.kind === "dir" ? "text-hz-amber" : it.kind === "log" ? "text-hz-violet" : "text-hz-cyan"}
              />
              <span className="text-[12.5px]">{it.name}</span>
              {it.kind !== "dir" && (
                <span className="ml-auto text-[10px] text-hz-muted">
                  {state.vfs[hostId]?.[it.path] ? "modifié" : "original"}
                </span>
              )}
            </button>
          ))}
          {!items.length && <p className="p-3 text-[12px] text-hz-muted">{t("files.empty")}</p>}
        </div>
        {file && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="min-w-0 break-all font-mono text-[12px] text-hz-accent">{file}</span>
              <button onClick={() => setFile(null)} className="text-hz-muted hover:text-hz-text">
                <Icon name="x" size={14} />
              </button>
            </div>
            <pre className="term-text max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-[12px] text-hz-text/90">
              {content ?? t("files.empty")}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================== TICKETS ==============================
export function TicketsApp() {
  const { state, engine, t } = useGame();
  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-1 text-[16px] font-bold">{t("tickets.title")}</h2>
      <p className="mb-4 text-[12px] text-hz-muted">{t("tickets.sub")}</p>
      <div className="space-y-2">
        {state.world.tickets.map((tk) => (
          <div key={tk.id} className="flex items-start gap-3 rounded-xl border border-hz-border bg-hz-panel p-3.5">
            <SeverityDot severity={tk.severity} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-hz-muted">{tk.id}</span>
                <Pill color={tk.severity === "critical" ? "var(--color-hz-red)" : tk.severity === "high" ? "#fb923c" : undefined}>
                  {t(`priority.${tk.severity}`)}
                </Pill>
                {tk.noise && (
                  <Pill color="var(--color-hz-muted)">{t("tickets.noise")}</Pill>
                )}
                <Pill
                  color={
                    tk.status === "open" ? "var(--color-hz-red)" : tk.status === "in_progress" ? "var(--color-hz-amber)" : "var(--color-hz-green)"
                  }
                >
                  {tk.status === "open" ? t("common.new") : tk.status === "in_progress" ? t("common.inProgress") : t("common.completed")}
                </Pill>
              </div>
              <p className="mt-1 text-[13px] font-medium">{t(tk.titleKey)}</p>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-hz-muted">
                <span className="flex items-center gap-1">
                  <Icon name="users" size={11} />
                  {tk.from}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="clock" size={11} />
                  {fmtClock(tk.createdAt)}
                </span>
              </div>
            </div>
            {tk.status !== "closed" && (
              <button onClick={() => engine.closeTicket(tk.id)} className="hz-btn hz-btn-ghost !py-1.5 !text-[12px]">
                <Icon name="success" size={13} />
                {t("tickets.close")}
              </button>
            )}
          </div>
        ))}
        {!state.world.tickets.length && (
          <p className="p-6 text-center text-[12.5px] text-hz-muted">{t("tickets.noTickets")}</p>
        )}
      </div>
    </div>
  );
}

// ============================== BROWSER ==============================
export function BrowserApp() {
  const { state, t } = useGame();
  const [site, setSite] = useState<string | null>(null);
  const [url, setUrl] = useState("intranet.horizon");

  const go = (u: string) => {
    const clean = u.replace(/^https?:\/\//, "").split("/")[0];
    setUrl(clean);
    setSite(INTERNAL_SITES[clean] ? clean : null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-hz-border p-2.5">
        <span className="flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-hz-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-hz-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-hz-green" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-hz-border bg-black/40 px-3 py-1.5">
          <Icon name="lock" size={12} className="text-hz-green" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go(url)}
            className="w-full bg-transparent font-mono text-[12.5px] outline-none"
          />
        </div>
        <button onClick={() => go(url)} className="hz-btn hz-btn-ghost !py-1.5 !text-[12px]">
          <Icon name="search" size={13} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-hz-border p-2.5">
        {Object.keys(INTERNAL_SITES).map((s) => (
          <button
            key={s}
            onClick={() => go(s)}
            className="rounded-lg border border-hz-border px-2.5 py-1 font-mono text-[11.5px] text-hz-muted transition-colors hover:border-hz-accent/50 hover:text-hz-accent"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {site ? (
          <div className="anim-fade-in mx-auto max-w-lg text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-hz-accent/40 bg-hz-accent/10">
                <Icon name="globe" size={26} className="text-hz-accent" />
              </div>
            </div>
            <h1 className="text-[22px] font-black tracking-tight">
              {INTERNAL_SITES[site].title}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-hz-text/80">
              {INTERNAL_SITES[site].body}
            </p>
            <p className="mt-6 text-[11px] text-hz-muted">
              200 OK — {site} · {state.world.hosts["SRV-WEB"]?.os ?? "nginx"}
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-hz-muted">
            <Icon name="globe" size={34} className="mb-2 opacity-30" />
            <p className="text-[13px]">
              {t("terminal.curlFail", { url: url })}
            </p>
            <p className="mt-1 text-[11px]">
              {Object.keys(INTERNAL_SITES).join(" · ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================== SKILLS ==============================
export function SkillsApp() {
  const { state, t } = useGame();
  const [track, setTrack] = useState("network");
  const skills = SKILLS.filter((s) => s.track === track);
  const trackDef = TRACKS.find((x) => x.id === track);
  const lang = state.profile?.lang ?? "fr";

  return (
    <div className="hz-skills-layout">
      <div className="hz-skills-sidebar">
        {TRACKS.map((tr) => {
          const has = SKILLS.some((s) => s.track === tr.id && state.skills[s.id]);
          return (
            <button
              key={tr.id}
              onClick={() => setTrack(tr.id)}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition-colors ${
                track === tr.id ? "bg-hz-panel2 text-hz-text" : "text-hz-muted hover:text-hz-text"
              }`}
            >
              {tr.label[lang]}
              {has && <span className="h-1.5 w-1.5 rounded-full" style={{ background: tr.color }} />}
            </button>
          );
        })}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {state.recommendedLabKey && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-hz-amber/40 bg-hz-amber/10 p-3.5">
            <Icon name="hint" size={16} className="mt-0.5 shrink-0 text-hz-amber" />
            <div>
              <p className="text-[12px] font-bold text-hz-amber">{t("skills.recommendationTitle")}</p>
              <p className="text-[12.5px] text-hz-text/90">{t(state.recommendedLabKey)}</p>
            </div>
          </div>
        )}
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: trackDef?.color }} />
          <h2 className="text-[15px] font-bold">{trackDef?.label[lang]}</h2>
        </div>
        <div className="space-y-2">
          {skills.map((s) => {
            const st = state.skills[s.id];
            const locked =
              s.prereq.length > 0 &&
              !s.prereq.some((p) => state.skills[p]);
            const lvl = st?.level ?? "discovery";
            return (
              <div key={s.id} className="hz-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold">
                    {s.label[lang]}
                    {locked && <Icon name="lock" size={12} className="ml-2 inline text-hz-muted" />}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                    style={{
                      color: LEVEL_COLOR[lvl],
                      background: `${LEVEL_COLOR[lvl]}18`,
                    }}
                  >
                    {t(`skills.levelName.${lvl}`)}
                  </span>
                </div>
                <div className="mt-2">
                  <Progress
                    value={lvl === "discovery" ? 8 : lvl === "learning" ? 25 : lvl === "practice" ? 50 : lvl === "competent" ? 70 : lvl === "proficient" ? 88 : 100}
                    color={LEVEL_COLOR[lvl]}
                    height={4}
                  />
                </div>
                {st && (
                  <div className="mt-1.5 flex gap-4 text-[10.5px] text-hz-muted">
                    <span>{t("skills.attempts")}: {st.attempts}</span>
                    <span>{t("skills.successRate")}: {st.attempts ? Math.round((st.successes / st.attempts) * 100) : 0}%</span>
                    <span>XP: {st.xp}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================== PORTFOLIO ==============================
export function PortfolioApp() {
  const { state, t } = useGame();
  const [cert, setCert] = useState<Certificate | null>(null);
  const lang = state.profile?.lang ?? "fr";
  const titleDef = TITLES.find((x) => x.id === state.titleKey);

  const downloadCert = (c: Certificate) => {
    const text = [
      "HORIZON CYBER ACADEMY",
      "ATTESTATION DE RÉUSSITE",
      "==============================",
      `${t("cert.holder")}: ${c.holderName}`,
      `${t("cert.certTitle")}: ${t(c.titleKey)}`,
      `${t("cert.id")}: ${c.id}`,
      `${t("cert.issued")}: ${new Date(c.issuedAt).toLocaleDateString()}`,
      `${t("cert.score")}: ${c.score}/100`,
      "",
      t("cert.skills") + ":",
      ...c.skills.map((s) => `- ${s.label} (${t(`skills.levelName.${s.level}`)})`),
      "",
      t("cert.signature"),
      t("cert.internalNote"),
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${c.id}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mx-auto max-w-2xl">
        {/* header card */}
        <div className="hz-card hz-portfolio-profile mb-4 flex flex-wrap items-center gap-4 p-5">
          <Avatar id={state.profile?.avatar ?? "a1"} name={state.profile?.name ?? "?"} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-black">{state.profile?.name}</h2>
            <p className="text-[12.5px] text-hz-accent">{titleDef ? t(titleDef.nameKey) : ""}</p>
            <p className="mt-0.5 text-[11px] text-hz-muted">
              {t("portfolio.memberSince")}: {new Date(state.startedAt).toLocaleDateString()} ·{" "}
              {t("portfolio.days")}: {state.day}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <Stat label="XP" value={state.xp} />
            <Stat label={t("portfolio.reputation")} value={state.reputation} />
            <Stat label={t("portfolio.badges")} value={state.badges.length} />
            <Stat label={t("portfolio.certificates")} value={state.certificates.length} />
          </div>
        </div>

        {/* badges */}
        <Section title={t("portfolio.badges")} icon="award">
          {state.badges.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {state.badges.map((b) => {
                const def = BADGES.find((x) => x.id === b);
                return (
                  <div key={b} className="rounded-xl border border-hz-border p-3 text-center">
                    <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-hz-amber/15">
                      <Icon name={def?.icon ?? "award"} size={18} className="text-hz-amber" />
                    </div>
                    <p className="text-[12px] font-bold">{def ? t(def.nameKey) : b}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-hz-muted">
                      {def ? t(def.descKey) : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-hz-muted">{t("portfolio.noBadges")}</p>
          )}
        </Section>

        {/* certificates */}
        <Section title={t("portfolio.certificates")} icon="badge">
          {state.certificates.length ? (
            <div className="space-y-2">
              {state.certificates.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-hz-border p-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-hz-accent/15">
                    <Icon name="badge" size={19} className="text-hz-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold">{t(c.titleKey)}</p>
                    <p className="font-mono text-[11px] text-hz-muted">{c.id}</p>
                  </div>
                  <button onClick={() => setCert(c)} className="hz-btn hz-btn-ghost !py-1.5 !text-[12px]">
                    {t("common.details")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-hz-muted">{t("portfolio.noCerts")}</p>
          )}
        </Section>

        {/* missions */}
        <Section title={t("portfolio.missions")} icon="target">
          <div className="space-y-1.5">
            {Object.values(state.missions).filter((m) => m.completedAt || m.bestScore).map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-hz-border px-3 py-2">
                <Icon name="success" size={15} className="text-hz-green" />
                <span className="flex-1 text-[12.5px] font-semibold">
                  {t(`missions.${m.id}.title`)}
                </span>
                <span className="text-[11.5px] text-hz-muted">
                  {t("academy.bestScore")}: {m.bestScore ?? m.score}
                </span>
              </div>
            ))}
            {!state.completedMissions.length && (
              <p className="text-[12px] text-hz-muted">{t("portfolio.noMissions")}</p>
            )}
          </div>
        </Section>
      </div>

      {/* certificate modal */}
      <Modal open={!!cert} onClose={() => setCert(null)} width={620}>
        {cert && (
          <div>
            <div
              className="relative overflow-hidden p-8 text-center"
              style={{
                background: "linear-gradient(160deg, #0d1424, #0a0e17)",
              }}
            >
              <div className="hz-scanline-decoration" aria-hidden="true" />
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.4em] text-hz-accent">
                {t("cert.academy")}
              </div>
              <h3 className="mb-4 text-[22px] font-black tracking-tight">
                {t("cert.certificate")}
              </h3>
              <div className="mx-auto mb-4 h-px w-40 bg-gradient-to-r from-transparent via-hz-accent to-transparent" />
              <p className="mb-1 text-[11px] uppercase tracking-[0.25em] text-hz-muted">
                {t("cert.holder")}
              </p>
              <p className="mb-4 text-[24px] font-bold">{cert.holderName}</p>
              <p className="mb-4 text-[15px] font-semibold text-hz-accent">
                {t(cert.titleKey)}
              </p>
              <div className="mx-auto mb-4 grid max-w-sm grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-hz-border p-2">
                  <div className="text-[9px] uppercase text-hz-muted">{t("cert.score")}</div>
                  <div className="text-[15px] font-bold">{cert.score}/100</div>
                </div>
                <div className="rounded-lg border border-hz-border p-2">
                  <div className="text-[9px] uppercase text-hz-muted">{t("cert.level")}</div>
                  <div className="text-[12px] font-bold">{cert.level}</div>
                </div>
                <div className="rounded-lg border border-hz-border p-2">
                  <div className="text-[9px] uppercase text-hz-muted">{t("cert.issued")}</div>
                  <div className="text-[12px] font-bold">
                    {new Date(cert.issuedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-hz-muted">
                {t("cert.skills")}
              </p>
              <div className="mb-4 flex flex-wrap justify-center gap-1.5">
                {cert.skills.map((s) => (
                  <Pill key={s.id} color="var(--color-hz-accent)">
                    {s.label}
                  </Pill>
                ))}
              </div>
              <p className="font-mono text-[11px] text-hz-muted">{cert.id}</p>
              <p className="mt-3 text-[10.5px] italic text-hz-muted">{t("cert.signature")}</p>
            </div>
            <div className="flex items-center justify-between border-t border-hz-border p-3">
              <p className="text-[10.5px] text-hz-muted">{t("cert.internalNote")}</p>
              <div className="flex gap-2">
                <button onClick={() => downloadCert(cert)} className="hz-btn hz-btn-ghost !py-1.5 !text-[12px]">
                  <Icon name="download" size={13} />
                  {t("common.download")}
                </button>
                <a
                  href={`/verify/${cert.id}`}
                  target="_blank"
                  className="hz-btn hz-btn-primary !py-1.5 !text-[12px]"
                >
                  <Icon name="search" size={13} />
                  {t("common.verify")}
                </a>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-hz-border px-3 py-1.5">
      <div className="text-[14px] font-black text-hz-accent">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-hz-muted">{label}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="hz-card mb-4 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-hz-muted">
        <Icon name={icon} size={14} className="text-hz-accent" />
        {title}
      </h3>
      {children}
    </section>
  );
}
