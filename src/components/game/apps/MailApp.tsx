"use client";

// ============================================================
// HORIZON OS — Mail application
// ============================================================

import { useMemo, useState } from "react";
import { useGame } from "../context";
import { Icon, Modal, fmtClock } from "../ui";
import type { Mail } from "@/game/types";

export default function MailApp() {
  const { state, engine, t } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [attach, setAttach] = useState<{ mail: Mail; name: string } | null>(null);

  const mails = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.mails;
    const has = (re: RegExp, key: string) => {
      const m = q.match(re);
      return m ? m[1] && key.toLowerCase().includes(m[1].toLowerCase()) : true;
    };
    return state.mails.filter((m) => {
      if (q.includes("from:") || q.includes("to:") || q.includes("subject:") || q.includes("has:attachment")) {
        const okFrom = has(/from:(\S+)/, m.from);
        const okTo = has(/to:(\S+)/, m.to);
        const okSubj = has(/subject:(\S+)/, t(m.subjectKey));
        const okAtt = q.includes("has:attachment") ? !!m.attachments?.length : true;
        const free = q
          .replace(/(?:from|to|subject):\S+|has:attachment/g, "")
          .trim();
        const okFree = !free || t(m.bodyKey).toLowerCase().includes(free);
        return okFrom && okTo && okSubj && okAtt && okFree;
      }
      return (
        t(m.subjectKey).toLowerCase().includes(q) ||
        t(m.bodyKey).toLowerCase().includes(q) ||
        m.from.toLowerCase().includes(q)
      );
    });
  }, [state.mails, query, t]);

  const current = state.mails.find((m) => m.id === selected);
  const unread = state.mails.filter((m) => !state.mailRead.includes(m.id)).length;

  const senderName = (id: string) =>
    id === "itsd"
      ? t("npc.itsd")
      : id.includes("@")
        ? id
        : t(`npc.${id}`);

  return (
    <div className="hz-mail-layout" data-reading={!!current}>
      {/* list */}
      <div className="hz-mail-list">
        <div className="border-b border-hz-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold">{t("mail.inbox")}</span>
            <span className="rounded-full bg-hz-cyan/15 px-2 py-0.5 text-[10px] font-bold text-hz-cyan">
              {t("mail.unread", { n: unread })}
            </span>
          </div>
          <div className="relative">
            <Icon name="search" size={13} className="absolute left-2.5 top-2.5 text-hz-muted" />
            <input
              data-testid="mail-search"
              data-window-autofocus=""
              aria-label={t("common.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("mail.searchPlaceholder")}
              className="hz-input w-full !pl-8 !py-1.5 text-[12px]"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {mails.map((m) => {
            const isUnread = !state.mailRead.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => {
                  setSelected(m.id);
                  engine.readMail(m.id);
                }}
                className={`flex w-full items-start gap-2.5 border-b border-hz-border/50 p-3 text-left transition-colors hover:bg-hz-panel2 ${
                  selected === m.id ? "bg-hz-panel2" : ""
                }`}
              >
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-hz-accent" : "bg-transparent"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12.5px] ${isUnread ? "font-bold text-hz-text" : "text-hz-text/80"}`}>
                    {senderName(m.from)}
                  </span>
                  <span className={`block truncate text-[12px] ${m.phish ? "text-hz-amber" : "text-hz-muted"}`}>
                    {t(m.subjectKey)}
                  </span>
                </span>
                {m.attachments?.length ? (
                  <Icon name="file" size={13} className="mt-1 shrink-0 text-hz-muted" />
                ) : null}
                <span className="mt-0.5 shrink-0 text-[10px] text-hz-muted">
                  {fmtClock(m.at)}
                </span>
              </button>
            );
          })}
          {!mails.length && (
            <p className="p-4 text-center text-[12px] text-hz-muted">{t("mail.noMail")}</p>
          )}
        </div>
      </div>

      {/* reader */}
      <div className="hz-mail-reader">
        {current ? (
          <div className="anim-fade-in">
            <button
              onClick={() => setSelected(null)}
              className="hz-btn hz-btn-ghost hz-mail-back"
            >
              <Icon name="arrowLeft" size={13} />
              {t("common.back")}
            </button>
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-[16px] font-bold leading-snug">
                {t(current.subjectKey)}
              </h2>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-[12px] text-hz-muted">
              <span className="font-semibold text-hz-cyan">{senderName(current.from)}</span>
              <span>→ {t("mail.to")}: {current.to === "player" ? state.profile?.name : current.to}</span>
              <span className="ml-auto">{fmtClock(current.at)}</span>
            </div>
            {current.phish && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-hz-amber/40 bg-hz-amber/10 p-3">
                <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-hz-amber" />
                <p className="text-[12px] leading-snug text-hz-amber">
                  {t("mail.phishWarning")}
                </p>
              </div>
            )}
            <div className="term-text whitespace-pre-wrap rounded-lg bg-black/30 p-4 text-hz-text/90">
              {t(current.bodyKey)}
            </div>
            {current.attachments?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-hz-muted">
                  {t("mail.attachments")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {current.attachments.map((a) => (
                    <button
                      key={a.name}
                      onClick={() => setAttach({ mail: current, name: a.name })}
                      className="hz-btn hz-btn-ghost !py-1.5 !text-[12px]"
                    >
                      <Icon name="file" size={13} />
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-hz-muted">
            <div className="text-center">
              <Icon name="mail" size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">HORIZON Mail</p>
            </div>
          </div>
        )}
      </div>

      {/* attachment viewer */}
      {attach && (
        <Modal open onClose={() => setAttach(null)} label={attach.name} width={700}>
          <div
            className="hz-card w-full max-w-2xl overflow-hidden anim-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hz-border px-4 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <Icon name="file" size={14} className="text-hz-green" />
                {attach.name}
              </span>
              <button onClick={() => setAttach(null)} className="text-hz-muted hover:text-hz-text">
                <Icon name="x" size={16} />
              </button>
            </div>
            <pre className="term-text max-h-80 overflow-y-auto bg-black/50 p-4 text-hz-text/90">
{`backup-agent: nightly backup report
target: COMP-01:/srv/files
status: COMPLETED WITH WARNINGS
----------------------------------------------
[ok]   /srv/files/finance      4.2 GB
[ok]   /srv/files/it           1.1 GB
[warn] /srv/files/logistics    LOCKED (2 files)
       - /srv/files/logistics/bons_2024_q3.xlsx (locked by paul)
       - /srv/files/logistics/inventaire.xlsx   (locked by paul)
[ok]   /srv/files/hr           0.8 GB
----------------------------------------------
next run: 02:00 (automatic)
`}
            </pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
