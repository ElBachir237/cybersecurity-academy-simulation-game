"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useGame } from "../context";
import { Icon, Modal } from "../ui";
import { audio } from "@/game/audio";

import { MAX_TERMINAL_INPUT, type TerminalBlock } from "@/game/workspace";
const EMPTY_BLOCKS: TerminalBlock[] = [];
interface ScrollPosition { top: number; follow: boolean }

export default function TerminalApp() {
  const { state, engine, t, overlayCount } = useGame();
  const hostId = state.workspace.terminal.hostId;
  const session = state.workspace.terminal.sessions[hostId];
  const [readingHistory, setReadingHistory] = useState(false);
  const scrollPositions = useRef<Record<string, ScrollPosition>>({});
  const forceFollow = useRef(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const beforeHistory = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scheduledFocus = useRef<number | null>(null);
  const live = useRef({ overlayCount });
  live.current = { overlayCount };
  const host = state.world.hosts[hostId];
  const blocks = session?.blocks ?? EMPTY_BLOCKS;
  const draft = session?.draft ?? "";
  const fr = state.profile?.lang !== "en";
  const editor = state.editorOpen;
  const active = state.activeWindow === "terminal";
  const canType = active && state.introSeen && overlayCount === 0 && !editor && !state.pendingDecision && !state.learning && !state.debrief;

  const focusInput = useCallback(() => {
    if (scheduledFocus.current !== null) cancelAnimationFrame(scheduledFocus.current);
    scheduledFocus.current = requestAnimationFrame(() => {
      const field = inputRef.current;
      const s = engine.state;
      if (!field || field.disabled || field.closest('[hidden], [inert]')) return;
      if (s.activeWindow !== "terminal" || s.editorOpen || s.pendingDecision || s.learning || s.debrief || !s.introSeen) return;
      if (live.current.overlayCount || document.querySelector('[data-horizon-dialog]')) return;
      field.focus({ preventScroll: true });
    });
  }, [engine]);

  // Host switching explicitly returns to the prompt. Other focus changes
  // belong to WindowFrame, so no delayed timer can hijack another app.
  useEffect(() => { focusInput(); }, [hostId, focusInput]);
  useEffect(() => () => {
    if (scheduledFocus.current !== null) cancelAnimationFrame(scheduledFocus.current);
  }, []);
  const lastBlockId = blocks[blocks.length - 1]?.id;
  // Keep an independent reading position per host. Ticks, drafts and
  // switching to another app must never jump the history to its end.
  useLayoutEffect(() => {
    if (!active || !scrollRef.current) return;
    const scroll = scrollRef.current;
    const position = scrollPositions.current[hostId];
    if (forceFollow.current || !position || position.follow) {
      scroll.scrollTop = scroll.scrollHeight;
      scrollPositions.current[hostId] = { top: scroll.scrollTop, follow: true };
      setReadingHistory(false);
    } else {
      scroll.scrollTop = position.top;
      setReadingHistory(scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop > 40);
    }
    forceFollow.current = false;
  }, [lastBlockId, active, hostId]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !active) return;
    const observer = new ResizeObserver(() => {
      if (scrollPositions.current[hostId]?.follow !== false) scroll.scrollTop = scroll.scrollHeight;
    });
    observer.observe(scroll);
    return () => observer.disconnect();
  }, [active, hostId]);

  const setDraft = (value: string) => engine.setTerminalDraft(hostId, value);
  const latest = () => {
    const scroll = scrollRef.current;
    if (scroll) {
      scroll.scrollTop = scroll.scrollHeight;
      scrollPositions.current[hostId] = { top: scroll.scrollTop, follow: true };
    }
    setReadingHistory(false);
    focusInput();
  };
  const clear = () => {
    forceFollow.current = true;
    engine.clearTerminalOutput(hostId);
    focusInput();
  };

  const run = (command: string) => {
    if (!canType || !command.trim()) return;
    forceFollow.current = true;
    engine.execTerminal(command.trim(), hostId);
    setDraft("");
    setHistoryIndex(null);
    focusInput();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      if (event.key === "Enter") event.preventDefault();
      return;
    }
    const history = engine.state.terminalHistory[hostId] ?? [];
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!history.length) return;
      if (historyIndex === null) beforeHistory.current = draft;
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setDraft(history[next] ?? "");
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) return;
      const next = historyIndex + 1;
      setHistoryIndex(next >= history.length ? null : next);
      setDraft(next >= history.length ? beforeHistory.current : history[next]);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault(); clear();
    } else if (event.ctrlKey && event.key.toLowerCase() === "c" && event.currentTarget.selectionStart === event.currentTarget.selectionEnd && !window.getSelection()?.toString()) {
      event.preventDefault(); setDraft(""); setHistoryIndex(null);
    } else if (event.key.length === 1 && draft.length % 5 === 0) {
      audio.key();
    }
  };

  return (
    <div className="hz-terminal" data-testid="terminal">
      <div className="hz-terminal-toolbar" data-testid="terminal-toolbar">
        <div className="hz-host-selector">
          <label htmlFor="terminal-host">{fr ? "POSTE DE TRAVAIL" : "WORKSTATION"}</label>
          <div className="hz-host-field">
            <Icon name="monitor" size={15} />
            <select
              id="terminal-host"
              aria-label={t("terminal.selectHost")}
              data-testid="terminal-host"
              value={hostId}
              onChange={(event) => { engine.selectTerminalHost(event.target.value); setHistoryIndex(null); }}
            >
              {Object.values(state.world.hosts).map((item) => <option value={item.id} key={item.id}>{item.id} — {item.id === "WS-001" ? (fr ? "Votre poste" : "Your workstation") : item.room}</option>)}
            </select>
          </div>
        </div>
        <div className="hz-terminal-connection"><span><span className="hz-live-dot" />{fr ? "Console ouverte" : "Console connected"}</span><b>{host?.os}</b></div>
        <div className="hz-terminal-tools">
          <button type="button" disabled={!canType} onClick={() => run("help")} title={fr ? "Afficher les commandes" : "Show commands"} aria-label={fr ? "Aide du terminal" : "Terminal help"}><Icon name="help" size={14} /><span>{fr ? "Aide" : "Help"}</span></button>
          <button type="button" disabled={!canType} onClick={clear} title="Ctrl + L" aria-label={fr ? "Effacer le terminal" : "Clear terminal"}><Icon name="clear" size={14} /><span>{fr ? "Effacer" : "Clear"}</span></button>
        </div>
      </div>

      <div className="hz-terminal-output-wrap">
      <div
        ref={scrollRef}
        className="hz-terminal-screen"
        data-testid="terminal-output"
        role="log"
        aria-label={fr ? "Historique du terminal" : "Terminal history"}
        aria-live={active ? "polite" : "off"}
        aria-relevant="additions"
        onScroll={(event) => {
          if (!active) return;
          const scroll = event.currentTarget;
          const follow = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
          scrollPositions.current[hostId] = { top: scroll.scrollTop, follow };
          setReadingHistory(!follow);
        }}
        onClick={(event) => {
          if (event.detail === 1 && !window.getSelection()?.toString()) focusInput();
        }}
      >
        <div className="hz-terminal-welcome">
          <div><Icon name="shield" size={14} /><span>HORIZON SHELL</span><small>{hostId} / {fr ? "SESSION LOCALE" : "LOCAL SESSION"}</small></div>
          <p>{t("terminal.welcome")}</p>
        </div>
        {blocks.map((block) => block.note ? (
          <p key={block.id} className="hz-terminal-editor-note">{block.output.join("\n")}</p>
        ) : (
          <section key={block.id} className="hz-command-block">
            <div className="hz-command-prompt"><span>student@{hostId.toLowerCase()}</span><b aria-hidden="true">❯</b><code>{block.command}</code></div>
            {block.output.map((line, index) => <div
              key={index}
              className={`hz-command-result ${/failed|failure|introuvable|refused|refusée|échec|unreachable|invalide/i.test(line) ? "is-error" : ""}`}
            >{line || "\u00a0"}</div>)}
          </section>
        ))}
      </div>

      {readingHistory && <button type="button" className="hz-terminal-latest" data-testid="terminal-latest" onClick={latest}><Icon name="arrowRight" size={12} className="rotate-90" />{fr ? "Dernières commandes" : "Latest commands"}</button>}
      </div>

      <form className="hz-terminal-composer" onSubmit={submit} data-testid="terminal-composer">
        <div className="hz-terminal-input-row" onClick={(event) => {
          if (event.target === event.currentTarget) focusInput();
        }}>
          <label htmlFor="terminal-command" className="hz-terminal-prompt-host">student@{hostId.toLowerCase()}</label>
          <span className="hz-terminal-prompt-symbol" aria-hidden="true">❯</span>
          <input
            id="terminal-command"
            ref={inputRef}
            className="hz-terminal-input"
            data-testid="terminal-input"
            data-window-autofocus=""
            name="command"
            type="text"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setHistoryIndex(null); }}
            onKeyDown={onKeyDown}
            disabled={!canType}
            placeholder={fr ? "Saisissez une commande…" : "Type a command…"}
            aria-label={fr ? "Commande du terminal" : "Terminal command"}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={MAX_TERMINAL_INPUT}
          />
          <button className="hz-terminal-submit" type="submit" disabled={!canType || !draft.trim()} aria-label={fr ? "Exécuter la commande" : "Run command"}><span>{fr ? "Exécuter" : "Run"}</span><Icon name="enter" size={14} /></button>
        </div>
        <div className="hz-terminal-shortcuts"><span><span><kbd>↵</kbd>{fr ? "Exécuter" : "Run"}</span><span><kbd>↑ ↓</kbd>{fr ? "Historique" : "History"}</span><span><kbd>Ctrl L</kbd>{fr ? "Effacer" : "Clear"}</span></span><span className="hz-shell-name">{fr ? "ENVIRONNEMENT SIMULÉ" : "SIMULATED ENVIRONMENT"}</span></div>
      </form>

      {active && editor && <FileEditor
        key={`${editor.hostId}:${editor.path}`}
        hostId={editor.hostId}
        path={editor.path}
        content={editor.content}
        onCancel={() => engine.cancelEdit()}
        onSave={(content) => {
          forceFollow.current = true;
          engine.writeFile(editor.hostId, editor.path, content);
        }}
      />}
    </div>
  );
}

function FileEditor({ hostId, path, content, onSave, onCancel }: {
  hostId: string;
  path: string;
  content: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const { t, state, engine } = useGame();
  const draft = state.workspace.editorDraft;
  const value = draft?.hostId === hostId && draft.path === path ? draft.content : content;
  const setValue = (text: string) => engine.setEditorDraft(hostId, path, text);
  const fr = state.profile?.lang !== "en";
  return <Modal open onClose={onCancel} width={800} label={t("terminal.editorTitle", { path })}>
    <form className="hz-editor" onSubmit={(event) => { event.preventDefault(); onSave(value); }} onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault(); event.stopPropagation(); onSave(value);
      }
    }}>
      <header className="hz-editor-header"><div><span className="hz-eyebrow"><Icon name="file" size={13} />{fr ? "ÉDITEUR DE CONFIGURATION" : "CONFIGURATION EDITOR"} · {hostId}</span><h2>{path}</h2></div><button type="button" className="hz-tool-button" onClick={onCancel} aria-label={t("common.close")}><Icon name="x" size={18} /></button></header>
      <textarea
        className="hz-editor-textarea"
        aria-label={fr ? "Contenu du fichier" : "File content"}
        data-dialog-autofocus=""
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        maxLength={24000}
        onKeyDown={(event) => {
          // Tab remains a navigation key. Ctrl+] inserts a two-space indent.
          if (event.ctrlKey && event.key === "]") {
            event.preventDefault();
            const target = event.currentTarget;
            const start = target.selectionStart;
            setValue(value.slice(0, start) + "  " + value.slice(target.selectionEnd));
            requestAnimationFrame(() => target.setSelectionRange(start + 2, start + 2));
          }
        }}
      />
      <footer className="hz-editor-footer"><span>{value === content ? (fr ? "Aucune modification" : "No changes") : (fr ? "Modifications non enregistrées" : "Unsaved changes")} · Ctrl + S</span><div><button type="button" className="hz-btn hz-btn-ghost" onClick={onCancel}>{t("common.cancel")}</button><button type="submit" className="hz-btn hz-btn-primary"><Icon name="save" size={14} />{t("terminal.saveFile")}</button></div></footer>
    </form>
  </Modal>;
}

export { readHostFile } from "@/game/terminal";
