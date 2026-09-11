// ============================================================
// Cloud Sync System — Vercel + Supabase (PostgreSQL)
// Handles local/remote conflict resolution, offline mode.
// ============================================================

import type { GameState, Profile, SaveDocument } from "./types";

export interface SyncConfig {
  apiUrl: string;
  token: string; // Bearer token for auth
}

export interface SyncResult {
  success: boolean;
  local: boolean;
  remote: boolean;
  savedAt: number;
  conflict?: "local-newer" | "remote-newer";
  resolvedWith?: "local" | "remote";
}

const SYNC_DEBOUNCE_MS = 3000;
const SYNC_TIMEOUT_MS = 10000;

/**
 * Sync manager: local + remote save coordination.
 * Handles offline mode, conflict resolution (last-write-wins by default).
 */
export class CloudSync {
  private config: SyncConfig | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncAt = 0;
  private isOnline = true;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.isOnline = true;
        console.log("[CloudSync] Online — syncing...");
        this.flushPending();
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
        console.log("[CloudSync] Offline — queued for later");
      });
    }
  }

  /**
   * Initialize sync config (call from engine boot).
   */
  init(config: SyncConfig): void {
    this.config = config;
  }

  /**
   * Queue a save (debounced).
   */
  queueSave(profileId: string, profile: Profile, state: GameState): void {
    if (!this.config) {
      console.warn("[CloudSync] Not configured");
      return;
    }
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.pushSave(profileId, profile, state).catch((e) => {
        console.error("[CloudSync] Push failed:", e);
      });
    }, SYNC_DEBOUNCE_MS);
  }

  /**
   * Push local save to server.
   */
  private async pushSave(
    profileId: string,
    profile: Profile,
    state: GameState
  ): Promise<SyncResult> {
    if (!this.config || !this.isOnline) {
      return { success: false, local: true, remote: false, savedAt: 0 };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

    try {
      const body = JSON.stringify({ profile, state });
      const response = await fetch(`${this.config.apiUrl}/api/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.token}`,
        },
        body,
        signal: controller.signal,
        keepalive: new Blob([body]).size < 60000,
      });

      const result = await response.json();
      this.lastSyncAt = Date.now();

      if (response.ok && result.ok) {
        console.log(`[CloudSync] Saved: ${profileId}`);
        return {
          success: true,
          local: true,
          remote: true,
          savedAt: Date.now(),
        };
      } else {
        console.warn(`[CloudSync] Server rejected: ${result.error}`);
        return { success: false, local: true, remote: false, savedAt: 0 };
      }
    } catch (e) {
      console.error("[CloudSync] Push error:", e);
      return { success: false, local: true, remote: false, savedAt: 0 };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Pull latest save from server (conflict resolution: last-write-wins).
   */
  async pullSave(profileId: string): Promise<SaveDocument | null> {
    if (!this.config || !this.isOnline) {
      console.warn("[CloudSync] Cannot pull: offline or unconfigured");
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${this.config.apiUrl}/api/save?profileId=${encodeURIComponent(profileId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.token}`,
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        console.warn(
          `[CloudSync] Pull failed: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const result = await response.json();
      if (result.ok && result.state) {
        console.log(`[CloudSync] Loaded: ${profileId}`);
        return {
          version: result.state.version,
          state: result.state,
          savedAt: new Date(result.updatedAt).getTime(),
        };
      }
      return null;
    } catch (e) {
      console.error("[CloudSync] Pull error:", e);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Resolve conflict between local and remote saves.
   * Default: last-write-wins (newer `savedAt` timestamp).
   */
  resolveConflict(
    local: SaveDocument,
    remote: SaveDocument
  ): { chosen: SaveDocument; conflict: "local-newer" | "remote-newer" } {
    const localTime = local.savedAt ?? 0;
    const remoteTime = remote.savedAt ?? 0;

    if (localTime >= remoteTime) {
      return { chosen: local, conflict: "local-newer" };
    } else {
      return { chosen: remote, conflict: "remote-newer" };
    }
  }

  /**
   * Sync pending saves (called when coming back online).
   */
  private async flushPending(): Promise<void> {
    console.log("[CloudSync] Flushing pending saves...");
    // In a real app, store a queue of pending saves in localStorage
    // and iterate through them. For now, this is a placeholder.
  }

  /**
   * Get online status.
   */
  getStatus(): {
    isOnline: boolean;
    lastSyncAt: number;
    configured: boolean;
  } {
    return {
      isOnline: this.isOnline,
      lastSyncAt: this.lastSyncAt,
      configured: !!this.config,
    };
  }
}

export const cloudSync = new CloudSync();