"use client";

// HORIZON OS — SOC dashboard. Chapters 8–10 branch a real SIEM / EDR queue.
import { useMemo, useState } from "react";
import { useGame } from "../context";
import { Icon, SEVERITY_COLOR, SeverityDot, fmtClock } from "../ui";
import type { SocAlert } from "@/game/data/soc";

export default function SocApp() {
  const { state, engine, t } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queue = state.world.socAlerts ?? [];
  const live = queue.filter((a) => a.status === "open");
  const selected = queue.find((a) => a.id === selectedId) ?? live[0] ?? queue[0];

  const fallbackAlerts = useMemo(
    () => state.notifications.filter((n) => n.kind === "soc" || n.kind === "it"),
    [state.notifications]
  );
  const hosts = Object.values(state.world.hosts);
  const upCount = hosts.filter((h) => Object.values(h.ifaces).some((i) => i.state === "up")).length;

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

  const statusLabel = (a: SocAlert) => {
    if (a.status === "fp") return t("soc.falsePositive");
    if (a.status === "escalated") return t("soc.escalated");
    return t("soc.open");
  };

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
              {live.length} {t("soc.open").toLowerCase()} · {upCount}/{hosts.length}{" "}
              {t("soc.hosts").toLowerCase()}
            </span>
          </div>
        </div>
        {queue.length === 0 && (
          <div className="mt-2.5 rounded-lg border border-hz-border bg-hz-panel2 p-2.5 text-[11.5px] leading-snug text-hz-muted">
            <Icon name="info" size={12} className="mr-1.5 inline text-hz-cyan" />
            {t("soc.previewNote")}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-4" data-testid="soc-queue">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-hz-muted">
            {t("soc.alerts")}
          </h3>
          {queue.length > 0 ? (
            <div className="space-y-2">
              {queue.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  data-testid={`soc-alert-${a.id}`}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                    selected?.id === a.id ? "border-hz-cyan/50 bg-hz-panel2" : "border-hz-border bg-hz-panel"
                  }`}
                >
                  <SeverityDot severity={a.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold">{t(a.titleKey)}</span>
                      <span className="shrink-0 text-[10px] text-hz-muted">{a.id}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                        style={{
                          color: SEVERITY_COLOR[a.severity],
                          background: `${SEVERITY_COLOR[a.severity]}18`,
                        }}
                      >
                        {t(`priority.${a.severity}`)}
                      </span>
                      <span className="text-[10.5px] text-hz-muted">{a.rule}</span>
                      <span className="text-[10.5px] text-hz-muted">{statusLabel(a)}</span>
                    </div>
                    {a.status === "open" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          role="button"
                          tabIndex={0}
                          data-testid={`soc-fp-${a.id}`}
                          className="hz-btn hz-btn-ghost !py-1 !text-[11px]"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            engine.dispatchAction("soc-fp", { id: a.id });
                          }}
                        >
                          {t("soc.falsePositive")}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          data-testid={`soc-escalate-${a.id}`}
                          className="hz-btn hz-btn-primary !py-1 !text-[11px]"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            engine.dispatchAction("soc-escalate", { id: a.id });
                          }}
                        >
                          {t("soc.escalate")}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : fallbackAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hz-border p-6 text-center">
              <Icon name="shield" size={24} className="mx-auto mb-2 text-hz-green opacity-60" />
              <p className="text-[12.5px] text-hz-muted">{t("soc.noAlerts")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fallbackAlerts.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-hz-border bg-hz-panel p-3">
                  <SeverityDot severity={a.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-semibold">{a.title}</span>
                      <span className="shrink-0 text-[10px] text-hz-muted">{fmtClock(a.at)}</span>
                    </div>
                    {a.body && <p className="mt-0.5 text-[11.5px] text-hz-muted">{a.body}</p>}
                    <div className="mt-1.5 text-[10.5px] text-hz-muted">{a.source}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden w-80 shrink-0 overflow-y-auto border-l border-hz-border p-4 md:block">
          {selected && queue.length > 0 ? (
            <div className="mb-6">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-hz-muted">
                {t("soc.triage")}
              </h3>
              <p className="text-[13px] font-semibold">{t(selected.titleKey)}</p>
              <p className="mt-2 text-[12px] leading-snug text-hz-muted">{t(selected.bodyKey)}</p>
              {selected.hostId && (
                <p className="mt-2 text-[11px] text-hz-cyan">
                  {t("soc.host")}: {selected.hostId}
                </p>
              )}
              {selected.status === "open" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="soc-fp"
                    className="hz-btn hz-btn-ghost !text-[12px]"
                    onClick={() => engine.dispatchAction("soc-fp", { id: selected.id })}
                  >
                    {t("soc.falsePositive")}
                  </button>
                  <button
                    type="button"
                    data-testid="soc-escalate"
                    className="hz-btn hz-btn-primary !text-[12px]"
                    onClick={() => engine.dispatchAction("soc-escalate", { id: selected.id })}
                  >
                    {t("soc.escalate")}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-hz-muted">{statusLabel(selected)}</p>
              )}
            </div>
          ) : null}
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
