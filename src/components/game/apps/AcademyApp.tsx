"use client";

import { useState } from "react";
import { useGame } from "../context";
import { Icon, Modal, Progress } from "../ui";
import { CHAPTERS, SKILLS } from "@/game/data/curriculum";
import { MISSIONS } from "@/game/data/missions";

export default function AcademyApp() {
  const { state, engine, t } = useGame();
  const [chapterId, setChapterId] = useState(1);
  const [theory, setTheory] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const lang = state.profile?.lang ?? "fr";
  const fr = lang === "fr";
  const chapter = CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0];
  const title = (id: number) =>
    id === 2 ? t("chapter2.title") : id === 3 ? t("chapter3.title") : CHAPTERS.find((item) => item.id === id)?.titleKey ?? "";
  const subtitle = chapter.id === 2 ? t("chapter2.sub") : chapter.id === 3 ? t("chapter3.sub") : t("academy.sub");
  const completed = chapter.missionIds.filter((id) => state.completedMissions.includes(id)).length;
  const brief = briefing ? MISSIONS[briefing] : null;

  return <div className="hz-academy-layout">
    <aside className="hz-academy-nav">
      <p className="hz-eyebrow">{fr ? "VOTRE PARCOURS" : "YOUR JOURNEY"}</p>
      {CHAPTERS.map((item) => <button type="button" key={item.id} className={item.id === chapterId ? "is-active" : ""} onClick={() => setChapterId(item.id)}>
        <span>{String(item.id).padStart(2, "0")}</span><div><b>{title(item.id)}</b><small>{item.status === "released" ? (fr ? "Disponible" : "Available") : item.status === "partial" ? (fr ? "En développement" : "In development") : (fr ? "À venir" : "Coming later")}</small></div>{item.status === "soon" && <Icon name="lock" size={12} />}
      </button>)}
    </aside>
    <div className="hz-academy-main">
      <label className="hz-academy-mobile-nav"><span className="hz-eyebrow">{t("academy.chapter")}</span><select value={chapterId} onChange={(event) => setChapterId(Number(event.target.value))} className="hz-input">{CHAPTERS.map((item) => <option key={item.id} value={item.id}>{item.id}. {title(item.id)}</option>)}</select></label>
      <header className="hz-academy-header"><div><span className="hz-eyebrow">{t("academy.chapter")} {chapter.id}</span><h1>{title(chapter.id)}</h1><p>{subtitle}</p></div>{chapter.missionIds.length > 0 && <div className="hz-academy-progress"><span>{completed}<small> / {chapter.missionIds.length}</small></span><Progress value={completed} max={chapter.missionIds.length} height={4} /></div>}</header>
      {chapter.status === "soon" ? <div className="hz-academy-preview"><Icon name="lock" size={26} /><h2>{fr ? "Un prochain chapitre de votre carrière." : "The next chapter in your career."}</h2><p>{fr ? "Ce parcours est en préparation. Vos compétences et votre progression seront conservées." : "This track is being prepared. Your skills and progress will be preserved."}</p></div> : <>
        <section className="hz-academy-section"><h2><Icon name="brain" size={16} />{t("academy.theory")}<small>{fr ? "L’essentiel avant d’agir" : "Just enough to take action"}</small></h2><div className="hz-theory-list">{chapter.theoryKeys.map((key) => <div key={key}><button type="button" aria-expanded={theory === key} onClick={() => setTheory(theory === key ? null : key)}><span>{t(`theory.${key}_title`)}</span><Icon name="chevronRight" size={15} className={theory === key ? "rotate-90" : ""} /></button>{theory === key && <p>{t(`theory.${key}_body`)}</p>}</div>)}</div></section>
        <section className="hz-academy-section"><h2><Icon name="target" size={16} />{fr ? "À vous de jouer" : "Put it into practice"}<small>{fr ? "Observer → agir → vérifier" : "Observe → act → verify"}</small></h2><div className="hz-mission-cards">{chapter.missionIds.map((id, index) => {
          const def = MISSIONS[id];
          const runtime = state.missions[id];
          const locked = runtime?.status === "locked";
          const active = state.activeMissionId === id;
          return <article key={id} className="hz-mission-card" data-testid={`mission-${id}`} data-active={active}>
            <div className="hz-mission-card-meta"><span>{String(index + 1).padStart(2, "0")} · {t(def.kind === "lab" ? "academy.lab" : def.kind === "simulation" ? "academy.sim" : "academy.mission")}</span><span><Icon name="clock" size={11} />{def.estimateMin} min</span></div>
            <h3>{t(def.titleKey)}</h3>
            <div className="hz-mission-skills">{def.skillIds.map((skill) => <span key={skill}>{SKILLS.find((item) => item.id === skill)?.label[lang] ?? skill}</span>)}</div>
            {runtime?.bestScore !== undefined && <p className="hz-best-score">{t("academy.bestScore")} : {runtime.bestScore}/100</p>}
            <button type="button" className={`hz-btn ${locked ? "hz-btn-ghost" : "hz-btn-primary"}`} disabled={locked} onClick={() => {
              if (locked || !runtime) return;
              if (active) engine.startMission(id);
              else setBriefing(id);
            }}><Icon name={locked ? "lock" : active ? "play" : runtime?.status === "completed" ? "retry" : "arrowRight"} size={14} />{locked ? t("common.locked") : active ? t("academy.resume") : runtime?.status === "completed" ? t("common.retry") : t("academy.start")}</button>
          </article>;
        })}</div></section>
      </>}
    </div>
    <Modal open={!!brief} onClose={() => setBriefing(null)} width={620} label={brief ? t(brief.titleKey) : t("academy.mission")}>
      {brief && <div className="hz-objectives-modal"><div className="hz-dialog-heading"><div><span className="hz-eyebrow">{t(`missions.${brief.id}.kind`)}</span><h2>{t(brief.titleKey)}</h2></div><button type="button" className="hz-tool-button" onClick={() => setBriefing(null)} aria-label={t("common.close")}><Icon name="x" size={18} /></button></div><p className="my-5 text-sm leading-relaxed text-hz-text/85">{t(brief.briefKey)}</p><ol className="hz-task-list">{brief.steps.flatMap((step) => step.tasks ?? []).map((task, index) => <li key={task.id}><span>{index + 1}</span><p>{t(task.labelKey)}</p></li>)}</ol><div className="flex justify-end gap-2"><button type="button" className="hz-btn hz-btn-ghost" onClick={() => setBriefing(null)}>{t("common.cancel")}</button><button type="button" className="hz-btn hz-btn-primary" onClick={() => { const id = brief.id; setBriefing(null); engine.startMission(id); }}><Icon name="play" size={15} />{t("common.start")}</button></div></div>}
    </Modal>
  </div>;
}
