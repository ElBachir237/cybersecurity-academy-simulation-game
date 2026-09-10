"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGame } from "./context";
import { APP_ICONS, Avatar, Icon, Modal, Progress, fmtClock } from "./ui";
import WindowFrame, { type WorkspaceBounds } from "./WindowFrame";
import { audio } from "@/game/audio";
import type { AppId } from "@/game/types";
import { MISSIONS } from "@/game/data/missions";
import TerminalApp from "./apps/TerminalApp";
import MailApp from "./apps/MailApp";
import ChatApp from "./apps/ChatApp";
import AcademyApp from "./apps/AcademyApp";
import NetworkApp from "./apps/NetworkApp";
import SocApp from "./apps/SocApp";
import { FilesApp, TicketsApp, BrowserApp, SkillsApp, PortfolioApp } from "./apps/SimpleApps";
import { NotificationCenter, DecisionModal, LearningModal, DebriefModal, IntroOverlay, SoundPopover, Toasts } from "./Modals";

const APP_ORDER: AppId[] = ["academy", "mail", "chat", "terminal", "browser", "network", "soc", "files", "tickets", "skills", "portfolio"];
const APPS: Record<AppId, () => ReactNode> = {
  terminal: TerminalApp, mail: MailApp, chat: ChatApp, academy: AcademyApp,
  network: NetworkApp, soc: SocApp, files: FilesApp, tickets: TicketsApp,
  browser: BrowserApp, skills: SkillsApp, portfolio: PortfolioApp,
};

export default function Desktop() {
  const { state, engine, t, overlayCount } = useGame();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const [showObjectives, setShowObjectives] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"idle" | "server" | "local" | "error">("idle");
  const stageRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<WorkspaceBounds>({ width: 1, height: 1 });
  const [visited, setVisited] = useState<AppId[]>(state.openWindows);
  // Closed or background apps stay mounted: draft text, editor selection
  // and scrollback survive switching, minimizing and reopening a window.
  const mountedApps = Array.from(new Set([...visited, ...state.openWindows]));
  const fr = state.profile?.lang !== "en";
  const active = state.activeWindow;
  const blocked = overlayCount > 0;
  const mission = state.activeMissionId ? state.missions[state.activeMissionId] : null;
  const missionDef = mission ? MISSIONS[mission.id] : null;
  const tasks = missionDef && mission ? (missionDef.steps[mission.stepIndex]?.tasks ?? []) : [];
  const done = tasks.filter((task) => mission?.tasks[task.id]?.done).length;
  const unread = state.notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setVisited((prev) => {
      const additions = state.openWindows.filter((app) => !prev.includes(app));
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [state.openWindows]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect();
      setBounds((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => engine.tick(), 5000);
    const saveId = setInterval(() => void engine.save(), 30000);
    const saveOnHide = () => { if (document.visibilityState === "hidden") void engine.save(); };
    const saveOnExit = () => { void engine.save(); };
    document.addEventListener("visibilitychange", saveOnHide);
    window.addEventListener("pagehide", saveOnExit);
    return () => {
      clearInterval(id); clearInterval(saveId);
      document.removeEventListener("visibilitychange", saveOnHide);
      window.removeEventListener("pagehide", saveOnExit);
    };
  }, [engine]);

  useEffect(() => {
    const unlock = () => { audio.ensure(); audio.applySettings(engine.state.sound); };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [engine]);

  useEffect(() => { document.documentElement.lang = fr ? "fr" : "en"; }, [fr]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      if (viewport && viewport.scale === 1)
        document.documentElement.style.setProperty("--hz-viewport-height", `${viewport.height}px`);
    };
    update();
    viewport?.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--hz-viewport-height");
    };
  }, []);

  const openApp = (app: AppId) => engine.openApp(app);
  const save = async () => {
    setSaving(true);
    const result = await engine.save();
    setSaveResult(result.remote ? "server" : result.local ? "local" : "error");
    setSaving(false);
  };

  return (
    <div className="hz-desktop" data-testid="desktop">
      <header className="hz-topbar" inert={blocked}>
        <div className="hz-brand">
          <span className="hz-brand-mark">H<span /></span>
          <div><strong>HORIZON<span>OS</span></strong><small>CYBER ACADEMY</small></div>
        </div>
        <div className="hz-topbar-location"><span />{fr ? "Siège · Bureau 3B" : "HQ · Office 3B"}</div>
        <div className="hz-topbar-tools">
          <span className="hz-clock"><Icon name="clock" size={14} /><span className="hz-day">{t("hud.day", { day: state.day })}</span><b>{fmtClock(state.timeMin)}</b></span>
          <button type="button" className="hz-tool-button" onClick={() => engine.setLang(fr ? "en" : "fr")} aria-label={fr ? "Passer en anglais" : "Switch to French"}>{fr ? "FR" : "EN"}</button>
          <button type="button" className="hz-tool-button hz-sound-button" onClick={() => setShowSound(true)} aria-label={t("hud.sound")}><Icon name={state.sound.muted ? "volumeOff" : "volume"} size={17} /></button>
          <button type="button" className="hz-tool-button hz-save-button" onClick={() => void save()} disabled={saving} aria-label={t("hud.save")} title={t("save.manual")}><Icon name="save" size={17} /></button>
          <button type="button" className="hz-tool-button hz-notifications-button" onClick={() => { engine.markAllNotificationsRead(); setShowNotifs(true); }} aria-label={t("hud.notifications")}><Icon name="bell" size={18} />{unread > 0 && <span className="hz-notification-dot" />}</button>
          <button type="button" className="hz-profile-button" onClick={() => openApp("portfolio")} aria-label={t("apps.portfolio.name")}>
            <Avatar id={state.profile?.avatar ?? "a1"} name={state.profile?.name ?? "?"} size={32} />
            <span><b>{state.profile?.name}</b><small>{t(`titles.${state.titleKey}`)}</small></span>
          </button>
        </div>
      </header>

      <nav className="hz-dock" aria-label={fr ? "Applications Horizon" : "Horizon applications"} inert={blocked}>
        <span className="hz-dock-label">APPS</span>
        <div className="hz-dock-apps">
          {APP_ORDER.map((app) => <button
            key={app}
            type="button"
            className={`hz-dock-app ${active === app ? "is-active" : ""}`}
            data-testid={`app-${app}`}
            onClick={() => openApp(app)}
            aria-label={t(`apps.${app}.name`)}
            aria-pressed={active === app}
            title={t(`apps.${app}.sub`)}
          >
            <Icon name={APP_ICONS[app]} size={20} />
            <span>{t(`apps.${app}.name`)}</span>
            {state.openWindows.includes(app) && <i aria-hidden="true" />}
          </button>)}
        </div>
        <div className="hz-dock-security"><Icon name="shield" size={17} /><span>HORIZON</span></div>
      </nav>

      <main className="hz-workspace" inert={blocked}>
        <section className="hz-mission-strip">
          <span className="hz-mission-icon"><Icon name={mission ? "target" : "building"} size={22} /></span>
          <div className="hz-mission-copy">
            <div className="hz-eyebrow">{fr ? "CHAPITRE" : "CHAPTER"} {state.chapter}<span>/</span>{state.chapter === 1 ? "FIRST DAY" : "NETWORK FOUNDATIONS"}{mission && <span className="hz-mission-live">{fr ? "EN COURS" : "IN PROGRESS"}</span>}</div>
            <h1>{missionDef ? t(missionDef.titleKey) : `${fr ? "Bienvenue" : "Welcome"}, ${state.profile?.name ?? ""}.`}</h1>
            <p>{state.currentObjective ? t(state.currentObjective) : t("hud.noObjective")}</p>
          </div>
          {tasks.length > 0 && <div className="hz-mission-progress"><span>{done}<small> / {tasks.length}</small></span><Progress value={done} max={tasks.length} height={4} /></div>}
          <button type="button" className="hz-mission-button" onClick={() => { if (mission) { setHint(null); setShowObjectives(true); } else openApp("academy"); }}>
            <Icon name={mission ? "target" : "academy"} size={15} /><span>{mission ? t("academy.objectives") : t("apps.academy.name")}</span><Icon name="chevronRight" size={14} />
          </button>
        </section>

        <div className="hz-workspace-tabs" role="tablist" aria-label={fr ? "Applications ouvertes" : "Open applications"}>
          {state.openWindows.length === 0 && <span className="hz-empty-tab"><Icon name="monitor" size={15} />{fr ? "Votre espace de travail" : "Your workspace"}</span>}
          {state.openWindows.map((app) => <button
            key={app}
            type="button"
            id={`tab-${app}`}
            role="tab"
            aria-controls={`window-${app}`}
            aria-selected={active === app}
            className={`hz-app-tab ${active === app ? "is-active" : ""}`}
            onClick={() => engine.focusWindow(app)}
            onKeyDown={(event) => {
              const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!direction) return;
              event.preventDefault();
              const index = state.openWindows.indexOf(app);
              const next = state.openWindows[(index + direction + state.openWindows.length) % state.openWindows.length];
              engine.focusWindow(next);
            }}
          ><Icon name={APP_ICONS[app]} size={15} /><span>{t(`apps.${app}.name`)}</span></button>)}
        </div>

        <div ref={stageRef} className="hz-window-stage" data-testid="window-stage">
          {mountedApps.map((app) => {
            const App = APPS[app];
            return <WindowFrame key={app} app={app} active={state.openWindows.includes(app) && active === app} bounds={bounds}><App /></WindowFrame>;
          })}
          {!active && <div className="hz-workspace-empty">
            <div className="hz-empty-symbol"><Icon name="monitor" size={30} /></div>
            <span className="hz-eyebrow">HORIZON CORPORATION</span>
            <h2>{fr ? "Votre poste est prêt." : "Your workstation is ready."}</h2>
            <p>{fr ? "Les bons outils. Une mission concrète. À vous de jouer." : "The right tools. A real-world mission. Your move."}</p>
            <div className="hz-empty-shortcuts">
              {(["academy", "terminal", "mail"] as AppId[]).map((app) => <button type="button" key={app} onClick={() => openApp(app)}><Icon name={APP_ICONS[app]} size={21} /><span>{t(`apps.${app}.name`)}</span><Icon name="arrowRight" size={14} /></button>)}
            </div>
          </div>}
        </div>
      </main>

      <footer className="hz-desktop-status">
        <span><span className="hz-live-dot" />{fr ? "LABORATOIRE ISOLÉ" : "ISOLATED LAB"}</span>
        <Toasts />
        <span className="hz-save-status" data-testid="save-status" data-result={saveResult} role="status"><Icon name="save" size={11} />{saving ? t("common.loading") : saveResult === "server" ? (fr ? "Sauvegardé sur le serveur" : "Saved to server") : saveResult === "local" ? (fr ? "Sauvegarde locale · serveur indisponible" : "Saved locally · server unavailable") : saveResult === "error" ? (fr ? "Échec de sauvegarde — réessayez" : "Save failed — try again") : t("save.auto")}</span>
      </footer>

      <NotificationCenter open={showNotifs} onClose={() => setShowNotifs(false)} />
      {showSound && <SoundPopover onClose={() => setShowSound(false)} />}
      <Modal open={showObjectives && !!mission} onClose={() => setShowObjectives(false)} label={t("academy.objectives")} width={540}>
        <div className="hz-objectives-modal">
          <div className="hz-dialog-heading"><div><span className="hz-eyebrow">{t("hud.mission")}</span><h2>{missionDef ? t(missionDef.titleKey) : ""}</h2></div><button type="button" className="hz-tool-button" onClick={() => setShowObjectives(false)} aria-label={t("common.close")}><Icon name="x" size={18} /></button></div>
          <p className="hz-objectives-context">{state.currentObjective ? t(state.currentObjective) : ""}</p>
          <ol className="hz-task-list">{tasks.map((task, index) => <li key={task.id} data-done={mission?.tasks[task.id]?.done}><span>{mission?.tasks[task.id]?.done ? <Icon name="success" size={17} /> : String(index + 1).padStart(2, "0")}</span><p>{t(task.labelKey)}</p></li>)}</ol>
          {missionDef?.kind !== "simulation" && <button type="button" className="hz-btn hz-btn-ghost" onClick={() => {
            const task = tasks.find((item) => !mission?.tasks[item.id]?.done && item.hintKey);
            if (task?.hintKey) { engine.useHint(); setHint(task.hintKey); }
          }}><Icon name="hint" size={15} />{t("common.hint")}</button>}
          {hint && <p className="hz-hint-message" role="status">{t(hint)}</p>}
        </div>
      </Modal>
      <DecisionModal />
      <LearningModal />
      <DebriefModal />
      <IntroOverlay />
    </div>
  );
}
