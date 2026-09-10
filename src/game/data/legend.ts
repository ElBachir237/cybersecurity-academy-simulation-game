// Legendary defensive ops — HORIZON fiction (ASTRAL space partner).
// Harden, contain, audit. No exploits, no nation-state attack playbooks.
import type { GameState, GameWorld, LegendState, Vhost } from "../types";

export const ASTRAL_HOST = "astral.horizon.local";
export const ASTRAL_IP = "10.0.0.20";
export const OT_CIDR = "10.50.0.0/24";

export function emptyLegend(): LegendState {
  return {
    headers: false,
    tls: false,
    autoindex: true,
    proxy: false,
    sgOpen: true,
    iamAdmin: true,
    gitSecret: true,
    bastion: false,
    otIsolated: false,
    zt: false,
    riskClosed: false,
    policySigned: false,
    supplierHeld: false,
  };
}

export function ensureLegend(world: GameWorld): LegendState {
  world.legend = { ...emptyLegend(), ...(world.legend ?? {}) };
  return world.legend;
}

export function legendOf(state: GameState): LegendState {
  return ensureLegend(state.world);
}

export function seedAstralSite(world: GameWorld): void {
  const L = ensureLegend(world);
  L.headers = false;
  L.tls = false;
  L.autoindex = true;
  L.proxy = false;
  world.dns = { ...(world.dns ?? {}), [ASTRAL_HOST]: ASTRAL_IP };
  const vh: Vhost = {
    serverName: ASTRAL_HOST,
    enabled: true,
    title: "ASTRAL × HORIZON — partner portal",
    body: "Télémétrie partenaire (simulation). Durcir avant publication.",
    headers: false,
    tls: false,
    autoindex: true,
    proxy: false,
  };
  world.vhosts = { ...(world.vhosts ?? {}), [ASTRAL_HOST]: vh };
}

export function syncAstralVhost(world: GameWorld): void {
  const L = ensureLegend(world);
  const vh = world.vhosts?.[ASTRAL_HOST];
  if (!vh) return;
  vh.headers = L.headers;
  vh.tls = L.tls;
  vh.autoindex = L.autoindex;
  vh.proxy = L.proxy;
}

export function seedOrbitCloud(world: GameWorld): void {
  const L = ensureLegend(world);
  L.sgOpen = true;
  L.iamAdmin = true;
  L.gitSecret = true;
}

export function seedBastion(world: GameWorld): void {
  const L = ensureLegend(world);
  L.bastion = false;
  L.otIsolated = false;
  L.zt = false;
}

export function seedMandat(world: GameWorld): void {
  const L = ensureLegend(world);
  L.riskClosed = false;
  L.policySigned = false;
  L.supplierHeld = false;
}

export const GIT_SECRET_SNIPPET = [
  "commit 7f3a1c2  (orbit-ci)",
  "Author: intern <intern@horizon.corp>",
  "",
  "+ ASTRAL_TELEMETRY_TOKEN=hz_live_not_a_real_secret",
  "  (secret in git — rotate, do not reuse)",
];
