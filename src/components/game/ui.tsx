"use client";

// ============================================================
// Shared UI primitives: icons, avatars, modal, progress, badges
// ============================================================

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Mail,
  MessageSquare,
  Terminal as TerminalIcon,
  Globe,
  Network as NetworkIcon,
  Shield,
  FolderOpen,
  Ticket,
  GraduationCap,
  Gauge,
  Briefcase,
  Compass,
  Search,
  ScrollText,
  Target,
  BrickWall,
  ChevronRight,
  X,
  Bell,
  Volume2,
  VolumeX,
  Save,
  Clock,
  Award,
  BadgeCheck,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Phone,
  Settings,
  Radio,
  Server,
  Wifi,
  Router,
  Monitor,
  Database,
  Cloud,
  Lock,
  Unlock,
  ArrowRight,
  ArrowLeft,
  Play,
  RotateCcw,
  Printer,
  Download,
  Lightbulb,
  Users,
  Activity,
  Layers,
  ShieldCheck,
  Fingerprint,
  Code2,
  Bug,
  BrainCircuit,
  Landmark,
  GitBranch,
  KeyRound,
  Building2,
  Cpu,
  Eye,
  MapPin,
  CalendarDays,
  Star,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeft,
  CornerDownLeft,
  Trash2,
  Copy,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import type { AppId, Severity, SkillLevel } from "@/game/types";

const ICONS: Record<string, LucideIcon> = {
  mail: Mail,
  chat: MessageSquare,
  terminal: TerminalIcon,
  browser: Globe,
  network: NetworkIcon,
  soc: Shield,
  files: FolderOpen,
  tickets: Ticket,
  academy: GraduationCap,
  skills: Gauge,
  portfolio: Briefcase,
  compass: Compass,
  search: Search,
  scroll: ScrollText,
  target: Target,
  brick: BrickWall,
  shield: ShieldCheck,
  chevronRight: ChevronRight,
  x: X,
  bell: Bell,
  volume: Volume2,
  volumeOff: VolumeX,
  save: Save,
  clock: Clock,
  award: Award,
  badge: BadgeCheck,
  file: FileText,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  error: XCircle,
  phone: Phone,
  settings: Settings,
  radio: Radio,
  server: Server,
  wifi: Wifi,
  router: Router,
  monitor: Monitor,
  database: Database,
  cloud: Cloud,
  lock: Lock,
  unlock: Unlock,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  play: Play,
  retry: RotateCcw,
  print: Printer,
  download: Download,
  hint: Lightbulb,
  users: Users,
  activity: Activity,
  layers: Layers,
  fingerprint: Fingerprint,
  code: Code2,
  bug: Bug,
  brain: BrainCircuit,
  landmark: Landmark,
  git: GitBranch,
  key: KeyRound,
  building: Building2,
  cpu: Cpu,
  eye: Eye,
  map: MapPin,
  calendar: CalendarDays,
  star: Star,
  maximize: Maximize2,
  restore: Minimize2,
  minimize: Minus,
  panel: PanelLeft,
  enter: CornerDownLeft,
  clear: Trash2,
  copy: Copy,
  help: CircleHelp,
  globe: Globe,
  folderOpen: FolderOpen,
};

export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.8,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name] ?? Info;
  return <Cmp size={size} className={className} strokeWidth={strokeWidth} />;
}

export const APP_ICONS: Record<AppId, string> = {
  mail: "mail",
  chat: "chat",
  terminal: "terminal",
  browser: "browser",
  network: "network",
  soc: "soc",
  files: "files",
  tickets: "tickets",
  academy: "academy",
  skills: "skills",
  portfolio: "portfolio",
};

// ---------------- Avatars (geometric badges) ----------------
const AVATAR_STYLES = [
  { bg: ["#0ea5a0", "#164e63"], accent: "#a5f3fc", shape: "circle" },
  { bg: ["#4f46e5", "#1e1b4b"], accent: "#c7d2fe", shape: "diamond" },
  { bg: ["#059669", "#022c22"], accent: "#a7f3d0", shape: "ring" },
  { bg: ["#d97706", "#451a03"], accent: "#fde68a", shape: "circle" },
  { bg: ["#dc2626", "#450a0a"], accent: "#fecaca", shape: "ring" },
  { bg: ["#7c3aed", "#2e1065"], accent: "#ddd6fe", shape: "diamond" },
] as const;

export function Avatar({
  id,
  name,
  size = 40,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  const idx = Math.max(0, AVATAR_STYLES.findIndex((_, i) => `a${i + 1}` === id));
  const style = AVATAR_STYLES[idx] ?? AVATAR_STYLES[0];
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="shrink-0 rounded-full"
      role="img"
      aria-label={name}
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={style.bg[0]} />
          <stop offset="100%" stopColor={style.bg[1]} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill={`url(#g-${id})`} />
      {style.shape === "circle" && (
        <circle cx="24" cy="24" r="15" fill="none" stroke={style.accent} strokeWidth="1.5" opacity="0.5" />
      )}
      {style.shape === "ring" && (
        <>
          <circle cx="24" cy="24" r="17" fill="none" stroke={style.accent} strokeWidth="1" opacity="0.35" />
          <circle cx="24" cy="24" r="11" fill="none" stroke={style.accent} strokeWidth="1.5" opacity="0.55" />
        </>
      )}
      {style.shape === "diamond" && (
        <rect x="11" y="11" width="26" height="26" fill="none" stroke={style.accent} strokeWidth="1.5" opacity="0.5" transform="rotate(45 24 24)" />
      )}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill={style.accent}
        fontFamily="var(--font-sans)"
      >
        {initial}
      </text>
    </svg>
  );
}

// Dialogs are portaled outside clipped or transformed windows.
export { Modal } from "./Dialog";

// ---------------- Progress / bars ----------------
export function Progress({
  value,
  max = 100,
  color = "var(--color-hz-accent)",
  height = 6,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: "rgba(36,51,84,0.5)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function Pill({
  children,
  color,
  icon,
}: {
  children: ReactNode;
  color?: string;
  icon?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        color: color ?? "var(--color-hz-text)",
        background: `color-mix(in srgb, ${color ?? "#243354"} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color ?? "#243354"} 30%, transparent)`,
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  info: "var(--color-hz-cyan)",
  low: "var(--color-hz-green)",
  medium: "var(--color-hz-amber)",
  high: "#fb923c",
  critical: "var(--color-hz-red)",
};

export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span
      className="anim-pulse-dot inline-block h-2 w-2 rounded-full"
      style={{ background: SEVERITY_COLOR[severity] }}
    />
  );
}

export const LEVEL_COLOR: Record<SkillLevel, string> = {
  discovery: "var(--color-hz-muted)",
  learning: "var(--color-hz-cyan)",
  practice: "var(--color-hz-green)",
  competent: "var(--color-hz-accent)",
  proficient: "var(--color-hz-amber)",
  mastered: "var(--color-hz-red)",
};

// ---------------- Time formatting ----------------
export function fmtClock(timeMin: number): string {
  const h = Math.floor(timeMin / 60) % 24;
  const m = timeMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtAgo(atMin: number, nowMin: number): string {
  const d = Math.max(0, nowMin - atMin);
  if (d < 1) return "à l'instant";
  if (d < 60) return `il y a ${d} min`;
  return `il y a ${Math.floor(d / 60)} h`;
}

// ---------------- Hook: interval ----------------
export function useInterval(cb: () => void, ms: number, active = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

export function useLocalOpen(initial = false) {
  return useState(initial);
}
