"use client";

// ============================================================
// HORIZON OS — SOC dashboard (preview; full chapter 4)
// Alerts shown here are REAL and linked to the player's missions.
// ============================================================

import { useMemo } from "react";
import { useGame } from "../context";
import { Icon, SEVERITY_COLOR, SeverityDot, fmtClock } from "../ui";

export default function SocApp() {
  const { state, t } = useGame();

  const alerts = useMemo(
    () => state.notifications.filter((n) => n.kind === "soc" || n.kind === "it"),
    [state.notifications]
  );
  const hosts = Object.values(state.world.hosts);
  const upCount = hosts.filter((h) =>
    Object.values(h.ifaces).some((i) => i.state === "up")
  ).length;

  const timeline = useMemo(
    () =>
      [
        ...state.notifications.map((n) => ({
          at: n.at,
          text: n.title,
          kind: n.severity,
        })),
        ...state.chat
          .filter((m) => m.channel === "itsupport" || m.channel === "soc")
          .map((m) => ({
            at: m.at,
            text: m.textKey ? t(m.textKey) : (m.text ?? ""),
            kind: "info" as const,
          })),
      ]
        .sort((a, b) => b.at - a.at)
        .slice(0, 14),
    [state.notifications, state.chat, t]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hz-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-bold">{t("soc.title")}</h2>
            <p className="text-[11.5px] text-hz-muted">{t("soc.sub")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-hz-green/40 bg-hz-green/10 px-3 py-1.5">
            <span className="anim-pulse-dot h-2 w-2 rounded-full bg-hz-green" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-hz-green">
              {upCount}/{hosts.length} {t("soc.hosts").toLowerCase()} {t("network.statusUp").toLowerCase()}
            </span>
          </div>
        </div>
        <div className="mt-2.5 rounded-lg border border-hz-border bg-hz-panel2 p-2.5 text-[11.5px] leading-snug text-hz-muted">
          <Icon name="info" size={12} className="mr-1.5 inline text-hz-cyan" />
          {t("soc.previewNote")}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* alerts */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-hz-muted">
            {t("soc.alerts")}
          </h3>
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hz-border p-6 text-center">
              <Icon name="shield" size={24} className="mx-auto mb-2 text-hz-green opacity-60" />
              <p className="text-[12.5px] text-hz-muted">{t("soc.noAlerts")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-hz-border bg-hz-panel p-3">
                  <SeverityDot severity={a.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold">{a.title}</span>
                      <span className="shrink-0 text-[10px] text-hz-muted">{fmtClock(a.at)}</span>
                    </div>
                    {a.body && <p className="mt-0.5 text-[11.5px] text-hz-muted">{a.body}</p>}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                        style={{
                          color: SEVERITY_COLOR[a.severity],
                          background: `${SEVERITY_COLOR[a.severity]}18`,
                        }}
                      >
                        {t(`priority.${a.severity}`)}
                      </span>
                      <span className="text-[10.5px] text-hz-muted">{a.source}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* timeline */}
        <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-hz-border p-4 md:block">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-hz-muted">
            {t("soc.timeline")}
          </h3>
          <div className="relative space-y-4 border-l border-hz-border pl-4">
            {timeline.map((ev, i) => (
              <div key={i} className="relative">
                <span
                  className="absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-hz-bg"
                  style={{ background: SEVERITY_COLOR[ev.kind] }}
                />
                <div className="text-[10px] font-mono text-hz-muted">{fmtClock(ev.at)}</div>
                <p className="text-[11.5px] leading-snug text-hz-text/85">{ev.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
