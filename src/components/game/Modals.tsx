"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "./context";
import { Icon, Modal, SeverityDot, fmtClock, LEVEL_COLOR } from "./ui";
import { audio } from "@/game/audio";
import { NPCS } from "@/game/data/world";
import { MISSIONS } from "@/game/data/missions";
import { SKILLS } from "@/game/data/curriculum";
import type { DecisionOption } from "@/game/types";

const INTRO_LINES = ["intro.msg1", "intro.msg2", "intro.msg3", "intro.msg4"];

export function IntroOverlay() {
  const { state, engine, t } = useGame();
  const [phase, setPhase] = useState(0);
  const show = !!state.profile && !state.introSeen;
  useEffect(() => {
    if (!show) return;
    const timers = INTRO_LINES.map((_, index) => setTimeout(() => setPhase(index + 1), 1200 * (index + 1)));
    audio.phone();
    return () => timers.forEach(clearTimeout);
  }, [show]);
  return <Modal open={show} dismissable={false} width={540} label={t("profile.title")} variant="call">
    <div className="p-6 sm:p-8">
      <div className="mb-6 text-center"><span className="hz-eyebrow justify-center">{t("intro.day")}</span><p className="mt-2 font-mono text-4xl font-medium text-hz-accent">08:42</p><p className="mt-2 text-xs text-hz-muted">{t("intro.subtitle")}</p></div>
      <div className="mb-6 flex items-center justify-center gap-3"><Icon name="phone" size={20} className="text-hz-accent" /><span className="text-sm font-semibold">{t("intro.phone")}</span></div>
      <div className="space-y-3">{INTRO_LINES.slice(0, phase).map((key) => <div key={key} className="rounded-xl border border-hz-border bg-hz-panel p-4"><p className="mb-1 text-[11px] font-bold text-hz-cyan">{t("npc.itsd")}</p><p className="text-sm">{t(key)}</p></div>)}</div>
      <div className="mt-6 text-center"><button type="button" className="hz-btn hz-btn-primary" onClick={() => { engine.markIntroSeen(); engine.openApp("academy"); audio.unlock(); }}><span>{t("intro.begin")}</span><Icon name="arrowRight" size={16} /></button></div>
    </div>
  </Modal>;
}

export function DecisionModal() {
  const { state, engine, t } = useGame();
  const decision = state.pendingDecision;
  const [picked, setPicked] = useState<DecisionOption | null>(null);
  useEffect(() => { if (decision) setPicked(null); }, [decision?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const npc = NPCS.find((person) => person.id === decision?.speaker);
  const isCall = decision?.kind === "call";
  const choose = (option: DecisionOption) => { setPicked(option); engine.answerDecision(option.id); };

  return <Modal open={!!decision || (!!picked && !state.learning)} dismissable={false} width={560} variant={isCall ? "call" : "default"} label={picked ? t("decision.consequence") : isCall ? t("decision.callFrom", { name: npc ? t(npc.nameKey) : "" }) : t("decision.title")}>
    <div className="p-6 sm:p-8">
      {picked && !decision ? <>
        <span className="hz-eyebrow">{t("decision.consequence")}</span>
        <div className="my-5 flex items-start gap-3"><Icon name={picked.correct ? "success" : "warning"} size={23} className={picked.correct ? "shrink-0 text-hz-green" : "shrink-0 text-hz-amber"} /><p className="text-sm leading-relaxed">{t(picked.consequenceKey)}</p></div>
        {!picked.correct && picked.whyKey !== picked.consequenceKey && <p className="mb-5 text-[13px] leading-relaxed text-hz-muted">{t(picked.whyKey)}</p>}
        <div className="flex justify-end"><button type="button" className="hz-btn hz-btn-primary" onClick={() => setPicked(null)}>{t("common.continue")}<Icon name="arrowRight" size={14} /></button></div>
      </> : decision ? <>
        <div className="mb-5 flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-hz-accent/30 bg-hz-accent/10"><Icon name={isCall ? "phone" : "warning"} size={22} className="text-hz-accent" /></div><div><span className="hz-eyebrow">{isCall ? `${fmtClock(state.timeMin)} · HORIZON` : t("decision.title")}</span><h2 className="mt-1 text-lg font-semibold">{isCall ? (npc ? t(npc.nameKey) : decision.speaker) : t("decision.choose")}</h2>{npc && <p className="mt-1 text-xs text-hz-muted">{t(npc.roleKey)}</p>}</div></div>
        <p className="mb-5 text-sm leading-relaxed text-hz-text/85">{t(decision.contextKey)}</p>
        <p className="mb-3 text-xs font-semibold text-hz-muted">{t(decision.questionKey)}</p>
        <div className="space-y-2.5">{decision.options.map((option) => <button type="button" key={option.id} onClick={() => choose(option)} className="flex w-full items-start gap-3 rounded-xl border border-hz-border bg-hz-panel p-4 text-left transition-colors hover:border-hz-accent/60 hover:bg-hz-panel2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-hz-border text-[11px] text-hz-accent">{option.id}</span><span className="text-[13px] leading-relaxed">{t(option.labelKey)}</span></button>)}</div>
      </> : null}
    </div>
  </Modal>;
}

export function LearningModal() {
  const { state, engine, t } = useGame();
  const learning = state.learning;
  return <Modal open={!!learning} dismissable={false} width={560} label={t("learning.title")}>
    {learning && <div className="p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3"><Icon name="warning" size={24} className="text-hz-amber" /><div><span className="hz-eyebrow">{t("learning.title")}</span><h2 className="mt-1 text-lg font-semibold">{t(learning.titleKey)}</h2></div></div>
      {learning.impactKey && <div className="mb-3 rounded-xl border border-hz-red/30 bg-hz-red/5 p-4"><p className="mb-2 text-xs font-semibold text-hz-red">{t("learning.impact")}</p><p className="text-[13px] leading-relaxed">{t(learning.impactKey)}</p></div>}
      <div className="mb-3 rounded-xl border border-hz-border bg-hz-panel p-4"><p className="mb-2 text-xs font-semibold text-hz-amber">{t("learning.why")}</p><p className="text-[13px] leading-relaxed">{t(learning.whyKey)}</p></div>
      <div className="mb-5 rounded-xl border border-hz-cyan/25 bg-hz-cyan/5 p-4"><p className="mb-2 text-xs font-semibold text-hz-cyan">{t("learning.check")}</p><p className="text-[13px] leading-relaxed">{t(learning.checkKey, { cause: learning.causeKey ? t(learning.causeKey) : "" })}</p></div>
      <div className="flex justify-end"><button type="button" className="hz-btn hz-btn-primary" onClick={() => engine.closeLearning()}>{t("learning.continue")}</button></div>
    </div>}
  </Modal>;
}

export function DebriefModal() {
  const { state, engine, t } = useGame();
  const debrief = state.debrief;
  const lang = state.profile?.lang ?? "fr";
  const hasCert = debrief?.missionId === "c1_sim" && state.certificates.some((cert) => cert.titleKey === "Cyber Explorer");
  return <Modal open={!!debrief} width={660} dismissable={false} label={t("debrief.title")}>
    {debrief && <div className="p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-hz-green/10"><Icon name="badge" size={26} className="text-hz-green" /></div><div className="min-w-0"><span className="hz-eyebrow">{t("debrief.title")}</span><h2 className="mt-1 text-lg font-semibold">{t(debrief.titleKey)}</h2></div><div className="ml-auto shrink-0 text-right"><span className="font-mono text-3xl text-hz-accent">{debrief.score}</span><p className="text-[10px] text-hz-muted">/ {debrief.maxScore}</p></div></div>
      <p className="mb-5 rounded-xl border border-hz-green/30 bg-hz-green/5 p-4 text-sm text-hz-green">{t(debrief.outcome === "success" ? "debrief.success" : "debrief.partial")}</p>
      {debrief.errors.length > 0 ? <section className="mb-5"><h3 className="mb-3 text-xs font-semibold text-hz-red">{t("debrief.errors")}</h3>{debrief.errors.map((error, index) => <div key={index} className="mb-2 rounded-lg border border-hz-red/25 p-3"><p className="text-sm font-medium">{t(error.whatKey)}</p><p className="mt-2 text-xs leading-relaxed text-hz-muted">{t(error.whyKey)}</p></div>)}</section> : <p className="mb-5 text-[13px] text-hz-muted">{t("debrief.noErrors")}</p>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">{[{ label: "debrief.method", key: debrief.methodKey }, { label: "debrief.nextStep", key: debrief.nextStepKey }].map((item) => <section key={item.label} className="rounded-xl border border-hz-border bg-hz-panel p-4"><h3 className="mb-2 text-xs font-semibold text-hz-cyan">{t(item.label)}</h3><p className="text-[12px] leading-relaxed">{t(item.key)}</p></section>)}</div>
      <section className="mb-5"><h3 className="mb-3 text-xs font-semibold text-hz-muted">{t("debrief.validated")}</h3><div className="flex flex-wrap gap-2">{debrief.skillsValidated.map((skill) => <span key={skill.id} className="rounded-md border px-2.5 py-1.5 text-[11px]" style={{ color: LEVEL_COLOR[skill.level], borderColor: `color-mix(in srgb, ${LEVEL_COLOR[skill.level]} 30%, transparent)` }}>{SKILLS.find((item) => item.id === skill.id)?.label[lang] ?? skill.id} · {t(`skills.levelName.${skill.level}`)}</span>)}</div></section>
      <details className="mb-5 rounded-xl border border-hz-border"><summary className="cursor-pointer p-3.5 text-xs font-semibold text-hz-muted">{t("debrief.report")}</summary><pre className="term-text max-h-48 overflow-auto border-t border-hz-border bg-black/30 p-4 text-hz-text/85">{debrief.report}</pre></details>
      {hasCert && <button type="button" className="mb-5 flex w-full items-center justify-between gap-3 rounded-xl border border-hz-accent/30 bg-hz-accent/5 p-4 text-left text-[13px]" onClick={() => { engine.closeDebrief(); engine.openApp("portfolio"); }}><Icon name="badge" size={19} className="shrink-0 text-hz-accent" /><span>{t("notifyContent.certReady")}</span><Icon name="arrowRight" size={16} /></button>}
      <div className="flex justify-end"><button type="button" className="hz-btn hz-btn-primary" onClick={() => engine.closeDebrief()}>{t("debrief.close")}<Icon name="arrowRight" size={14} /></button></div>
    </div>}
  </Modal>;
}

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, engine, t } = useGame();
  return <Modal open={open} onClose={onClose} width={430} variant="sheet" label={t("notify.title")}>
    <div className="p-5">
      <div className="hz-dialog-heading"><h2 className="flex items-center gap-2"><Icon name="bell" size={18} className="text-hz-accent" />{t("notify.title")}</h2><button type="button" className="hz-tool-button" onClick={onClose} aria-label={t("common.close")}><Icon name="x" size={18} /></button></div>
      <button type="button" className="my-3 text-[11px] text-hz-muted hover:text-hz-text" onClick={() => engine.markAllNotificationsRead()}>{t("notify.markAllRead")}</button>
      <div className="space-y-2">{!state.notifications.length && <p className="py-5 text-center text-sm text-hz-muted">{t("notify.empty")}</p>}{state.notifications.map((notification) => <button type="button" key={notification.id} className="flex w-full items-start gap-3 rounded-xl border border-hz-border bg-hz-panel p-3.5 text-left hover:bg-hz-panel2" onClick={() => { if (notification.linkMission) { onClose(); engine.openApp("academy"); } else engine.dismissNotification(notification.id); }}>
        <span className="mt-1.5 shrink-0"><SeverityDot severity={notification.severity} /></span><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between gap-2 text-[10px] text-hz-muted"><span>{notification.source}</span><span>{fmtClock(notification.at)}</span></div><p className="text-[12px] leading-relaxed">{notification.title}</p>{notification.body && <p className="mt-1 text-[11px] leading-relaxed text-hz-muted">{notification.body}</p>}</div>
      </button>)}</div>
    </div>
  </Modal>;
}

export function SoundPopover({ onClose }: { onClose: () => void }) {
  const { state, engine, t } = useGame();
  const sound = state.sound;
  const fr = state.profile?.lang !== "en";
  return <Modal open onClose={onClose} width={360} variant="sheet" label={fr ? "Réglages audio" : "Audio settings"}>
    <div className="p-5">
      <div className="hz-dialog-heading"><h2 className="flex items-center gap-2"><Icon name="volume" size={17} />{fr ? "Réglages audio" : "Audio settings"}</h2><button type="button" className="hz-tool-button" onClick={onClose} aria-label={t("common.close")}><Icon name="x" size={17} /></button></div>
      <button type="button" className="my-4 flex w-full items-center justify-between rounded-lg border border-hz-border p-3 text-xs" onClick={() => engine.setSound({ muted: !sound.muted })} aria-pressed={sound.muted}><span>{fr ? "Couper le son" : "Mute audio"}</span><Icon name={sound.muted ? "volumeOff" : "volume"} size={16} /></button>
      <Slider label={fr ? "Volume général" : "Master volume"} value={sound.master} onChange={(value) => engine.setSound({ master: value })} />
      <Slider label={fr ? "Musique" : "Music"} value={sound.music} onChange={(value) => engine.setSound({ music: value })} />
      <Slider label={fr ? "Effets" : "Effects"} value={sound.sfx} onChange={(value) => engine.setSound({ sfx: value })} />
      <Slider label={fr ? "Ambiance" : "Ambience"} value={sound.ambient} onChange={(value) => engine.setSound({ ambient: value })} />
    </div>
  </Modal>;
}
function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="mb-4 block"><span className="mb-2 flex justify-between text-xs text-hz-muted">{label}<span className="font-mono">{Math.round(value * 100)}%</span></span><input type="range" min={0} max={1} step={0.05} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-teal-300" /></label>;
}

/** Task feedback stays in the status bar, never on top of the terminal. */
export function Toasts() {
  const { state, engine, t } = useGame();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ids = state.toasts.map((toast) => toast.id).filter((id): id is string => !!id).join("|");
  useEffect(() => {
    const currentIds = ids.split("|").filter(Boolean);
    for (const id of currentIds) if (!timers.current.has(id)) timers.current.set(id, setTimeout(() => {
      timers.current.delete(id);
      engine.dismissToast(id);
    }, 4500));
    for (const [id, timer] of timers.current) if (!currentIds.includes(id)) { clearTimeout(timer); timers.current.delete(id); }
  }, [ids, engine]);
  useEffect(() => {
    const current = timers.current;
    return () => { for (const timer of current.values()) clearTimeout(timer); current.clear(); };
  }, []);
  const toast = state.toasts[state.toasts.length - 1];
  return <div className="hz-feedback" role="status" aria-live="polite">{toast && <><Icon name={toast.kind === "success" ? "success" : toast.kind === "error" ? "error" : "info"} size={12} /><span title={toast.textKey ? t(toast.textKey) : toast.text}>{toast.textKey ? t(toast.textKey) : toast.text}</span></>}</div>;
}
