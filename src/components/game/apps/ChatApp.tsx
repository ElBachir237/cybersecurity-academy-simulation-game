"use client";

// ============================================================
// HORIZON OS — Chat application (internal channels)
// ============================================================

import { useEffect, useMemo, useRef } from "react";
import { useGame } from "../context";
import { Icon, fmtClock } from "../ui";
import { CHANNELS } from "@/game/data/world";

export default function ChatApp() {
  const { state, engine, t, overlayCount } = useGame();
  const channel = state.workspace.chat.channel;
  const draft = state.workspace.chat.drafts[channel] ?? "";
  const setDraft = (text: string) => engine.setChatDraft(channel, text);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = state.activeWindow === "chat";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (engine.state.activeWindow === "chat" && !document.querySelector('[data-horizon-dialog]')) inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [channel, engine]);

  const messages = useMemo(
    () => state.chat.filter((m) => m.channel === channel),
    [state.chat, channel]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, channel]);

  const senderName = (id: string) =>
    id === "player"
      ? state.profile?.name ?? t("chat.you")
      : id === "system"
        ? t("npc.system")
        : t(`npc.${id}`);

  const send = () => {
    const text = draft.trim();
    if (!text || !active || overlayCount > 0) return;
    setDraft("");
    engine.sendChat(channel, text);
  };

  return (
    <div className="hz-chat-layout">
      {/* channels — icon rail on mobile, full sidebar on desktop */}
      <div className="hz-chat-channels">
        <p className="hz-channel-label mb-3 text-[10px] uppercase tracking-widest text-hz-muted">
          {t("chat.channels")}
        </p>
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            onClick={() => engine.selectChatChannel(c.id)}
            title={t(c.nameKey)}
            aria-label={t(c.nameKey)}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold transition-colors ${
              channel === c.id
                ? "bg-hz-accent/15 text-hz-accent"
                : "text-hz-text/80 hover:bg-hz-panel2"
            }`}
          >
            <Icon name="radio" size={14} className="shrink-0" />
            <span className="hz-channel-label">{t(c.nameKey)}</span>
          </button>
        ))}
        <div className="hz-channel-label mt-3 rounded-lg border border-hz-border p-2.5 text-[10.5px] text-hz-muted">
          <Icon name="users" size={12} className="mb-1" />
          {t("chat.members", { n: 24 })}
        </div>
      </div>

      {/* messages */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="hz-chat-heading"><span># {t(CHANNELS.find((item) => item.id === channel)?.nameKey ?? "chat.itSupport")}</span><small>{state.profile?.lang === "en" ? "Your draft is saved automatically" : "Votre brouillon est conservé automatiquement"}</small></div>
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => {
            const mine = m.from === "player";
            const sys = m.from === "system";
            if (sys) {
              return (
                <div key={m.id} className="text-center">
                  <span className="rounded-full bg-hz-panel2 px-3 py-1 text-[10.5px] italic text-hz-muted">
                    {m.textKey ? t(m.textKey) : m.text}
                  </span>
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                    mine
                      ? "rounded-br-sm bg-hz-accent/20 text-hz-text"
                      : "rounded-bl-sm border border-hz-border bg-hz-panel2"
                  }`}
                >
                  {!mine && (
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-hz-cyan">
                        {senderName(m.from)}
                      </span>
                      <span className="text-[9.5px] text-hz-muted">
                        {fmtClock(m.at)}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[13px] leading-snug">
                    {m.textKey ? t(m.textKey) : m.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* composer */}
        <div className="shrink-0 border-t border-hz-border p-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              disabled={!active || overlayCount > 0}
              data-testid="chat-input"
              data-window-autofocus=""
              aria-label={t("chat.placeholder")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
              placeholder={t("chat.placeholder")}
              maxLength={500}
              className="hz-input flex-1 !py-2 text-[13px]"
            />
            <button onClick={send} type="button" disabled={!draft.trim() || !active || overlayCount > 0} aria-label={t("chat.send")} className="hz-btn hz-btn-primary !px-4">
              <Icon name="arrowRight" size={15} />
              <span className="hz-chat-send-label">{t("chat.send")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
