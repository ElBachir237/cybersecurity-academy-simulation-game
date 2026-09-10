"use client";

// ============================================================
// HORIZON OS — Boot + profile creation / resume
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, Avatar } from "@/components/game/ui";
import { GameEngine, loadLocalSave, setEngine } from "@/game/engine";
import { audio } from "@/game/audio";
import type { Lang, Profile } from "@/game/types";

const BOOT_LINES = 5;

export default function HomePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"boot" | "menu" | "profile">("boot");
  const [bootLine, setBootLine] = useState(0);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("a1");
  const [lang, setLang] = useState<Lang>("fr");
  const [error, setError] = useState("");
  const [hasSave, setHasSave] = useState(false);
  const [saveInfo, setSaveInfo] = useState<{ name: string; lang: Lang } | null>(null);

  useEffect(() => {
    const saved = loadLocalSave();
    if (saved?.state?.profile) {
      setHasSave(true);
      setSaveInfo({
        name: saved.state.profile.name,
        lang: saved.state.profile.lang,
      });
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBootLine((l) => {
        if (l >= BOOT_LINES) {
          clearInterval(id);
          setTimeout(() => setPhase("menu"), 500);
          return l;
        }
        return l + 1;
      });
    }, 520);
    return () => clearInterval(id);
  }, []);

  const bootLines = useMemo(
    () => [
      "HORIZON OS v4.2 — démarrage",
      "Vérification matérielle ............ OK",
      "Montage des volumes chiffrés ....... OK",
      "Chargement du profil utilisateur ...",
      "Connexion au réseau interne ........ OK",
      "Bienvenue au siège HORIZON CORPORATION.",
    ],
    []
  );

  const createProfile = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(lang === "fr" ? "Saisissez votre nom (2 caractères min.)." : "Enter your name (2 chars min).");
      return;
    }
    audio.ensure();
    audio.boot();
    const profile: Profile = {
      name: trimmed,
      avatar,
      lang,
      createdAt: Date.now(),
    };
    const eng = GameEngine.bootstrap(profile);
    setEngine(eng);
    void eng.save();
    router.push("/desktop");
  };

  const resume = () => {
    audio.ensure();
    const saved = loadLocalSave();
    if (!saved?.state) return;
    const eng = new GameEngine(saved.state);
    setEngine(eng);
    router.push("/desktop");
  };

  return (
    <div className="hz-grid-bg relative flex min-h-screen items-center justify-center overflow-hidden bg-hz-bg p-4">
      <div className="pointer-events-none absolute inset-0 hz-glow" />

      {/* ================= BOOT ================= */}
      {phase === "boot" && (
        <div className="w-full max-w-xl">
          <div className="mb-6 text-center">
            <div className="mb-2 text-[28px] font-black tracking-[0.35em] text-hz-text">
              HORIZON<span className="text-hz-accent">OS</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-hz-muted">
              Cyber Academy
            </div>
          </div>
          <div className="hz-card term-text min-h-48 p-5">
            {bootLines.slice(0, bootLine).map((l, i) => (
              <div key={i} className="anim-fade-in text-hz-text/85">
                <span className="mr-2 text-hz-accent">[{String(i).padStart(2, "0")}]</span>
                {l}
                {i === bootLine - 1 && bootLine < BOOT_LINES && (
                  <span className="anim-blink ml-1 inline-block h-3.5 w-2 bg-hz-accent" />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setPhase("menu")}
            className="mx-auto mt-5 block text-[12px] text-hz-muted underline-offset-4 hover:text-hz-text hover:underline"
          >
            Passer
          </button>
        </div>
      )}

      {/* ================= MENU ================= */}
      {phase === "menu" && (
        <div className="w-full max-w-md anim-fade-up">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-hz-accent/40 bg-hz-accent/10">
              <Icon name="shield" size={30} className="text-hz-accent" />
            </div>
            <h1 className="text-[30px] font-black tracking-tight">
              HORIZON<span className="text-hz-accent">OS</span>
            </h1>
            <p className="mt-1 text-[13px] text-hz-muted">
              Simulation pédagogique immersive de cybersécurité
            </p>
          </div>

          {hasSave && saveInfo && (
            <div className="hz-card mb-4 flex items-center gap-4 p-4">
              <Avatar id="a1" name={saveInfo.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{saveInfo.name}</p>
                <p className="text-[11px] text-hz-muted">
                  {saveInfo.lang === "fr" ? "Partie sauvegardée" : "Saved game"} ·{" "}
                  {saveInfo.lang.toUpperCase()}
                </p>
              </div>
              <button onClick={resume} className="hz-btn hz-btn-primary">
                <Icon name="play" size={14} />
                {saveInfo.lang === "fr" ? "Reprendre" : "Resume"}
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setLang(saveInfo?.lang ?? "fr");
              setPhase("profile");
            }}
            className={`hz-btn w-full justify-center !py-3 !text-[14px] ${
              hasSave ? "hz-btn-ghost" : "hz-btn-primary"
            }`}
          >
            <Icon name="users" size={16} />
            {hasSave
              ? lang === "fr"
                ? "Nouveau profil"
                : "New profile"
              : lang === "fr"
                ? "Créer mon profil"
                : "Create my profile"}
          </button>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-hz-muted">
            <span>FR</span>
            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              className="relative h-5 w-9 rounded-full bg-hz-border"
              aria-label="language"
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-hz-accent transition-all"
                style={{ left: lang === "fr" ? 2 : 18 }}
              />
            </button>
            <span>EN</span>
          </div>
        </div>
      )}

      {/* ================= PROFILE CREATION ================= */}
      {phase === "profile" && (
        <div className="w-full max-w-lg anim-fade-up">
          <div className="mb-6 text-center">
            <h1 className="text-[24px] font-black">
              {lang === "fr" ? "Votre premier jour" : "Your first day"}
            </h1>
            <p className="mt-1 text-[13px] text-hz-muted">
              {lang === "fr"
                ? "L'équipe IT a préparé votre poste. Créez votre profil pour entrer dans le bâtiment."
                : "IT prepared your workstation. Create your profile to enter the building."}
            </p>
          </div>

          <div className="hz-card p-6">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-hz-muted">
              {lang === "fr" ? "Nom d'employé" : "Employee name"}
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && createProfile()}
              placeholder={lang === "fr" ? "Ex. : Alex Moreau" : "E.g.: Alex Moreau"}
              maxLength={30}
              className="hz-input mb-4 w-full !py-2.5"
              autoFocus
            />
            {error && (
              <p className="mb-3 text-[12px] text-hz-red">{error}</p>
            )}

            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-hz-muted">
              {lang === "fr" ? "Choisissez votre badge" : "Choose your badge"}
            </label>
            <div className="mb-5 flex flex-wrap gap-3">
              {["a1", "a2", "a3", "a4", "a5", "a6"].map((id) => (
                <button
                  key={id}
                  onClick={() => setAvatar(id)}
                  className={`rounded-2xl p-1 transition-all ${
                    avatar === id
                      ? "bg-hz-accent/20 ring-2 ring-hz-accent"
                      : "bg-hz-panel2 hover:bg-hz-border/40"
                  }`}
                >
                  <Avatar id={id} name={name || "?"} size={44} />
                </button>
              ))}
            </div>

            <div className="mb-5 flex items-center justify-between rounded-xl border border-hz-border p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-hz-muted">
                {lang === "fr" ? "Langue de travail" : "Working language"}
              </span>
              <div className="flex gap-2">
                {(["fr", "en"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                      lang === l
                        ? "bg-hz-accent/20 text-hz-accent ring-1 ring-hz-accent/60"
                        : "text-hz-muted hover:text-hz-text"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase("menu")}
                className="hz-btn hz-btn-ghost"
              >
                <Icon name="arrowLeft" size={15} />
                {lang === "fr" ? "Retour" : "Back"}
              </button>
              <button
                onClick={createProfile}
                className="hz-btn hz-btn-primary flex-1 justify-center !py-3 !text-[14px]"
              >
                {lang === "fr" ? "Entrer chez HORIZON" : "Enter HORIZON"}
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[10.5px] text-hz-muted">
            {lang === "fr"
              ? "Votre progression est sauvegardée automatiquement sur cet appareil."
              : "Your progress is autosaved on this device."}
          </p>
        </div>
      )}
    </div>
  );
}
