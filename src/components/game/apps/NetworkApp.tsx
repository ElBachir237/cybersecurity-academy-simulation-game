"use client";

// ============================================================
// HORIZON OS — Network: topology viewer + subnet calculator
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useGame } from "../context";
import { Icon } from "../ui";
import { TOPO_LINKS, TOPO_NODES, type TopoNode } from "@/game/data/world";
import type { HostRuntime } from "@/game/types";
import type { WorkshopKind } from "@/game/data/workshop";

function ipToInt(ip: string): number {
  return ip.split(".").reduce((a, o) => (a << 8) + parseInt(o, 10), 0) >>> 0;
}
function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function calcSubnet(ip: string, cidr: number) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) || !Number.isInteger(cidr) || cidr < 0 || cidr > 32 || ip.split(".").some((part) => Number(part) > 255)) return null;
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  const addr = ipToInt(ip);
  const network = (addr & mask) >>> 0;
  const broadcast = (network | ~mask) >>> 0;
  const total = Math.pow(2, 32 - cidr);
  const usable = cidr >= 31 ? (cidr === 31 ? 2 : 1) : total - 2;
  return {
    network: intToIp(network),
    mask: intToIp(mask),
    first: intToIp(network + (cidr >= 31 ? 0 : 1)),
    last: intToIp(broadcast - (cidr >= 31 ? 0 : 1)),
    broadcast: intToIp(broadcast),
    total,
    usable,
  };
}

export default function NetworkApp() {
  const { state, engine, t } = useGame();
  const [tab, setTab] = useState<"topo" | "workshop" | "calc">("topo");
  const [sel, setSel] = useState<string | null>(null);
  const [cableFrom, setCableFrom] = useState<string | null>(null);
  const [cableMode, setCableMode] = useState(false);
  const [ip, setIp] = useState("10.0.0.0");
  const [cidr, setCidr] = useState(26);
  const [count, setCount] = useState(0);
  const [fired, setFired] = useState(false);

  const result = useMemo(() => calcSubnet(ip, cidr), [ip, cidr]);

  const runCalc = () => {
    if (!result) return;
    const n = count + 1;
    setCount(n);
    engine.dispatchAction("subnet-calc", {
      count: n,
      ip,
      cidr,
      network: result.network,
      usable: result.usable,
    });
    if (n >= 3 && !fired) {
      setFired(true);
      engine.openApp("network");
    }
  };

  const nodeKindIcon = (kind: TopoNode["kind"]) =>
    kind === "router"
      ? "router"
      : kind === "switch"
        ? "layers"
        : kind === "server"
          ? "server"
          : kind === "ap"
            ? "wifi"
            : "monitor";

  const hostUp = (h: HostRuntime) =>
    Object.values(h.ifaces).some((i) => i.state === "up" && (i.ip || i.dhcp));

  const selHost = sel ? state.world.hosts[sel] : null;
  const workshopOpen =
    state.completedMissions.includes("c6_sim") ||
    ["available", "active", "completed"].includes(state.missions["e5_lab"]?.status ?? "");
  const ws = state.world.workshop ?? { nodes: [], links: [] };

  useEffect(() => {
    if (state.activeMissionId?.startsWith("e5_")) setTab("workshop");
  }, [state.activeMissionId]);

  const place = (kind: WorkshopKind) => {
    engine.dispatchAction("workshop-place", { kind });
  };
  const clickWorkshopNode = (id: string) => {
    if (cableMode) {
      if (!cableFrom) {
        setCableFrom(id);
        setSel(id);
        return;
      }
      if (cableFrom !== id) engine.dispatchAction("workshop-cable", { a: cableFrom, b: id });
      setCableFrom(null);
      setSel(id);
      return;
    }
    setSel(sel === id ? null : id);
  };

  return (
    <div className="flex h-full flex-col">
      {/* tabs */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-hz-border p-2">
        <TabBtn active={tab === "topo"} onClick={() => setTab("topo")} icon="network" label={t("network.devices")} />
        {workshopOpen && (
          <TabBtn active={tab === "workshop"} onClick={() => setTab("workshop")} icon="layers" label={t("workshop.tab")} />
        )}
        <TabBtn active={tab === "calc"} onClick={() => setTab("calc")} icon="cpu" label="CIDR" />
        <div className="ml-auto hidden items-center gap-3 pr-2 text-[11px] text-hz-muted sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-hz-green" /> {t("network.statusUp")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-hz-red" /> {t("network.statusDown")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-hz-amber" /> {t("network.statusDegraded")}
          </span>
        </div>
      </div>

      {tab === "workshop" ? (
        <div className="hz-network-layout">
          <div className="hz-network-map">
            <div className="absolute left-2 right-2 top-2 z-10 flex flex-wrap items-center gap-1">
              {(["pfsense", "switch", "server", "pc", "ap"] as WorkshopKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  data-testid={`workshop-place-${kind}`}
                  className="hz-btn hz-btn-ghost px-2 py-1 text-[11px]"
                  onClick={() => place(kind)}
                >
                  {t(`workshop.kind.${kind}`)}
                </button>
              ))}
              <button
                type="button"
                data-testid="workshop-cable"
                className={`hz-btn px-2 py-1 text-[11px] ${cableMode ? "hz-btn-primary" : "hz-btn-ghost"}`}
                onClick={() => {
                  setCableMode((v) => !v);
                  setCableFrom(null);
                }}
              >
                {t("workshop.cable")}
              </button>
            </div>
            <svg viewBox="0 0 800 400" className="h-full w-full" aria-label={t("workshop.tab")} data-testid="workshop-map">
              {ws.links.map(([a, b]) => {
                const na = ws.nodes.find((n) => n.id === a);
                const nb = ws.nodes.find((n) => n.id === b);
                if (!na || !nb) return null;
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={na.x}
                    y1={na.y}
                    x2={nb.x}
                    y2={nb.y}
                    stroke="rgba(53,224,210,0.4)"
                    strokeWidth={2}
                  />
                );
              })}
              {ws.nodes.map((n) => {
                const h = state.world.hosts[n.id];
                const up = h ? hostUp(h) : false;
                const active = sel === n.id || cableFrom === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    className="cursor-pointer"
                    data-testid={`workshop-node-${n.id}`}
                    onClick={() => clickWorkshopNode(n.id)}
                  >
                    <rect
                      x={-36}
                      y={-22}
                      width={72}
                      height={44}
                      rx={9}
                      fill={active ? "rgba(53,224,210,0.18)" : "rgba(13,20,36,0.92)"}
                      stroke={active ? "var(--color-hz-accent)" : "var(--color-hz-border)"}
                      strokeWidth={active ? 1.8 : 1.2}
                    />
                    <text textAnchor="middle" y={-2} fontSize={11} fill={up ? "var(--color-hz-text)" : "var(--color-hz-muted)"} fontWeight={600}>
                      {n.id}
                    </text>
                    <circle cx={28} cy={-14} r={4} fill={up ? "var(--color-hz-green)" : "var(--color-hz-amber)"} />
                  </g>
                );
              })}
            </svg>
            <div className="pointer-events-none absolute bottom-2 left-3 text-[10.5px] text-hz-muted">
              {cableMode ? t("workshop.cableHint") : t("workshop.hint")}
            </div>
          </div>
          <div className="hz-network-details">
            {selHost && ws.nodes.some((n) => n.id === sel) ? (
              <div className="anim-fade-in">
                <h3 className="text-[14px] font-bold">{selHost.label}</h3>
                <p className="mb-3 text-[11px] text-hz-muted">{selHost.os}</p>
                {Object.entries(selHost.ifaces).map(([name, i]) => (
                  <div key={name} className="mb-1.5 rounded-lg border border-hz-border p-2 text-[11.5px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{name}</span>
                      <span className="font-mono text-hz-muted">{i.ip ? `${i.ip}/${i.cidr}` : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-center text-hz-muted">
                <Icon name="layers" size={26} className="mb-2 opacity-40" />
                <p className="text-[12px]">{t("workshop.empty")}</p>
              </div>
            )}
          </div>
        </div>
      ) : tab === "topo" ? (
        <div className="hz-network-layout">
          <div className="hz-network-map">
            <svg viewBox="0 0 800 400" className="h-full w-full" aria-label={t("network.title")}>
              {/* links */}
              {TOPO_LINKS.map(([a, b]) => {
                const na = TOPO_NODES.find((n) => n.id === a)!;
                const nb = TOPO_NODES.find((n) => n.id === b)!;
                const ha = state.world.hosts[a];
                const hb = state.world.hosts[b];
                const down =
                  (ha && !hostUp(ha)) || (hb && !hostUp(hb));
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={na.x}
                    y1={na.y}
                    x2={nb.x}
                    y2={nb.y}
                    stroke={down ? "rgba(248,113,113,0.5)" : "rgba(53,224,210,0.28)"}
                    strokeWidth={down ? 1.5 : 2}
                    strokeDasharray={down ? "5 5" : undefined}
                  />
                );
              })}
              {/* nodes */}
              {TOPO_NODES.map((n) => {
                const h = state.world.hosts[n.id];
                const up = h ? hostUp(h) : true;
                const active = sel === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    className="cursor-pointer"
                    onClick={() => setSel(active ? null : n.id)}
                  >
                    <rect
                      x={-34}
                      y={-22}
                      width={68}
                      height={44}
                      rx={9}
                      fill={active ? "rgba(53,224,210,0.18)" : "rgba(13,20,36,0.92)"}
                      stroke={active ? "var(--color-hz-accent)" : "var(--color-hz-border)"}
                      strokeWidth={active ? 1.8 : 1.2}
                    />
                    <text
                      textAnchor="middle"
                      y={-2}
                      fontSize={11}
                      fill={up ? "var(--color-hz-text)" : "var(--color-hz-muted)"}
                      fontWeight={600}
                    >
                      {n.id}
                    </text>
                    <circle
                      cx={26}
                      cy={-14}
                      r={4}
                      fill={up ? "var(--color-hz-green)" : "var(--color-hz-red)"}
                      className="anim-pulse-dot"
                    />
                  </g>
                );
              })}
            </svg>
            <div className="pointer-events-none absolute bottom-2 left-3 text-[10.5px] text-hz-muted">
              {t("network.sub")}
            </div>
          </div>

          {/* details */}
          <div className="hz-network-details">
            {selHost ? (
              <div className="anim-fade-in">
                <div className="mb-1 flex items-center gap-2">
                  <Icon name={nodeKindIcon(TOPO_NODES.find((n) => n.id === sel)?.kind ?? "pc")} size={16} className="text-hz-accent" />
                  <h3 className="text-[14px] font-bold">{selHost.label}</h3>
                </div>
                <p className="mb-3 text-[11px] text-hz-muted">
                  {selHost.os} · {selHost.room}
                </p>
                <Detail label={t("network.role")} value={selHost.id} />
                <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-hz-muted">
                  {t("network.iface")}
                </p>
                {Object.entries(selHost.ifaces).map(([name, i]) => (
                  <div key={name} className="mb-1.5 rounded-lg border border-hz-border p-2 text-[11.5px]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{name}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                        style={{
                          background: i.state === "up" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                          color: i.state === "up" ? "var(--color-hz-green)" : "var(--color-hz-red)",
                        }}
                      >
                        {i.state}
                      </span>
                    </div>
                    {i.ip && (
                      <div className="mt-1 font-mono text-hz-muted">
                        {i.ip}/{i.cidr} {i.dhcp ? "(DHCP)" : ""}
                        {i.gw ? ` gw ${i.gw}` : ""}
                      </div>
                    )}
                  </div>
                ))}
                <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-hz-muted">
                  DNS
                </p>
                <div className="font-mono text-[11.5px] text-hz-text/85">
                  {selHost.dns.join(", ")}
                </div>
                {Object.keys(selHost.services).length > 0 && (
                  <>
                    <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wider text-hz-muted">
                      {t("network.services")}
                    </p>
                    {Object.entries(selHost.services).map(([s, st]) => (
                      <div key={s} className="flex items-center justify-between py-0.5 text-[11.5px]">
                        <span className="font-mono">{s}</span>
                        <span style={{ color: st === "active" ? "var(--color-hz-green)" : st === "failed" ? "var(--color-hz-red)" : "var(--color-hz-muted)" }}>
                          {st}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-center text-hz-muted">
                <Icon name="network" size={26} className="mb-2 opacity-40" />
                <p className="text-[12px]">{t("network.noSelection")}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-xl">
            <h3 className="mb-1 text-[15px] font-bold">
              {t("missions.c2_lab.title")}
            </h3>
            <p className="mb-4 text-[12.5px] text-hz-muted">
              {t("missions.c2_lab.brief")}
            </p>
            <div className="hz-card p-5">
              <div className="hz-subnet-inputs">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-hz-muted">
                    {t("network.ip")}
                  </span>
                  <input
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    className="hz-input w-full font-mono text-[13px]"
                    placeholder="10.0.0.0"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-hz-muted">
                    CIDR
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={32}
                      value={cidr}
                      onChange={(e) => setCidr(parseInt(e.target.value, 10))}
                      className="flex-1 accent-teal-300"
                    />
                    <span className="w-10 rounded bg-black/40 px-1.5 py-1 text-center font-mono text-[13px] text-hz-accent">
                      /{cidr}
                    </span>
                  </div>
                </label>
              </div>
              <button onClick={runCalc} className="hz-btn hz-btn-primary mt-4 w-full justify-center">
                <Icon name="search" size={15} />
                {t("common.details")}
              </button>
              {result ? (
                <div className="hz-subnet-results">
                  <ResultRow label="Réseau" value={result.network} />
                  <ResultRow label="Masque" value={result.mask} />
                  <ResultRow label="1er hôte" value={result.first} />
                  <ResultRow label="Dernier hôte" value={result.last} />
                  <ResultRow label="Broadcast" value={result.broadcast} />
                  <ResultRow label="Hôtes utilisables" value={String(result.usable)} accent />
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-hz-red/40 bg-hz-red/10 p-3 text-[12px] text-hz-red">
                  Adresse ou masque invalide.
                </p>
              )}
              <p className="mt-4 text-[11px] text-hz-muted">
                {t("missions.c2_lab.t1")} — {count}/3
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active ? "bg-hz-accent/15 text-hz-accent" : "text-hz-muted hover:text-hz-text"
      }`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hz-border/50 py-1.5 text-[12px]">
      <span className="text-hz-muted">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

function ResultRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-hz-border bg-black/30 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-hz-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-[14px] ${accent ? "font-bold text-hz-accent" : "text-hz-text"}`}>
        {value}
      </div>
    </div>
  );
}
