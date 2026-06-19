import type { AppConfig, ParityCommandStatus, ParityCommandType, ParitySyncSnapshot } from "../shared/types";
import type { AppLogger } from "../main/logger";
import type { EnvLocalSupabaseSettings } from "../main/config-store";
import { looksLikeSupabaseServiceRoleKey } from "../main/config-store";

export const PARITY_COMMAND_TYPES: readonly ParityCommandType[] = [
  "request-status-refresh",
  "request-dry-run",
  "request-confirmation",
  "cancel-confirmation",
  "perform-configured-action",
  "recalculate-today-schedule"
];

export const PARITY_COMMAND_STATUSES: readonly ParityCommandStatus[] = [
  "pending",
  "claimed",
  "succeeded",
  "failed",
  "expired",
  "rejected",
  "cancelled"
];

interface EffectiveParitySyncSettings {
  supabaseUrl: URL;
  publishableKey: string;
}

export class ParitySyncService {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private commandTimer: NodeJS.Timeout | null = null;
  private lastStartedAt: string | null = null;
  private lastStoppedAt: string | null = null;
  private lastCheckedAt: string | null = null;
  private lastError: string | null = null;
  private hasLoggedDisabled = false;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    private readonly envLocal: EnvLocalSupabaseSettings
  ) {}

  start(): void {
    if (this.heartbeatTimer || this.commandTimer) {
      return;
    }

    if (!this.config.paritySync.enabled) {
      this.lastError = null;
      this.logDisabledOnce();
      return;
    }

    if (!this.effectiveSettings()) {
      this.lastError = null;
      this.logger.info("Supabase parity sync not configured; no runtime writes or command processing started.");
      return;
    }

    this.lastStartedAt = new Date().toISOString();
    this.lastStoppedAt = null;
    this.lastError = null;
    this.logger.info("Supabase parity sync skeleton started. Runtime writes and command processing are disabled.");

    this.heartbeatTimer = setInterval(() => {
      this.recordNoOpCheck("heartbeat/log/skip/schedule-completion");
    }, this.heartbeatIntervalMs());

    this.commandTimer = setInterval(() => {
      this.recordNoOpCheck("command");
    }, this.commandPollIntervalMs());
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.commandTimer) {
      clearInterval(this.commandTimer);
      this.commandTimer = null;
    }

    if (this.lastStartedAt) {
      this.lastStoppedAt = new Date().toISOString();
      this.logger.info("Supabase parity sync skeleton stopped.");
    }
  }

  configure(): void {
    this.stop();
    this.start();
  }

  getStatus(): ParitySyncSnapshot {
    const effectiveSettings = this.effectiveSettings();
    const active = Boolean(this.heartbeatTimer || this.commandTimer);
    const enabled = this.config.paritySync.enabled;
    const configured = Boolean(effectiveSettings);

    return {
      enabled,
      configured,
      active,
      health: !enabled ? "disabled" : configured ? active ? "active" : "idle" : "not-configured",
      endpointHost: effectiveSettings?.supabaseUrl.host ?? null,
      keyStatus: this.keyStatus(),
      deviceId: this.config.paritySync.deviceId,
      deviceLabel: sanitizeStatusText(this.config.paritySync.deviceLabel || "A.L.I.L.O.S. desktop", 120) ?? "A.L.I.L.O.S. desktop",
      heartbeatIntervalSeconds: this.config.paritySync.heartbeatIntervalSeconds,
      commandPollIntervalSeconds: this.config.paritySync.commandPollIntervalSeconds,
      featureFlags: {
        logUploadEnabled: this.config.paritySync.logUploadEnabled,
        skipSyncEnabled: this.config.paritySync.skipSyncEnabled,
        commandSyncEnabled: this.config.paritySync.commandSyncEnabled,
        scheduleCompletionSyncEnabled: this.config.paritySync.scheduleCompletionSyncEnabled
      },
      lastStartedAt: this.lastStartedAt,
      lastStoppedAt: this.lastStoppedAt,
      lastCheckedAt: this.lastCheckedAt,
      lastError: this.lastError,
      note: this.note(enabled, configured, active)
    };
  }

  private recordNoOpCheck(scope: string): void {
    this.lastCheckedAt = new Date().toISOString();
    this.lastError = null;
    this.logger.info(`Supabase parity sync ${scope} check skipped: runtime writes and command processing are not implemented.`);
  }

  private logDisabledOnce(): void {
    if (this.hasLoggedDisabled) {
      return;
    }

    this.hasLoggedDisabled = true;
    this.logger.info("Supabase parity sync disabled; no runtime writes or command processing.");
  }

  private effectiveSettings(): EffectiveParitySyncSettings | null {
    const supabaseUrl = parseSupabaseUrl(this.config.paritySync.supabaseUrl.trim() || this.envLocal.supabaseUrl.trim());
    const publishableKey = (this.config.paritySync.publishableKey.trim() || this.envLocal.publishableKey.trim()).trim();

    if (!supabaseUrl || !publishableKey || looksLikeSupabaseServiceRoleKey(publishableKey)) {
      return null;
    }

    return { supabaseUrl, publishableKey };
  }

  private keyStatus(): ParitySyncSnapshot["keyStatus"] {
    if (this.config.paritySync.publishableKey.trim()) {
      return looksLikeSupabaseServiceRoleKey(this.config.paritySync.publishableKey) ? "missing" : "configured";
    }

    if (this.envLocal.publishableKey.trim()) {
      return looksLikeSupabaseServiceRoleKey(this.envLocal.publishableKey) ? "missing" : "env-local";
    }

    return "missing";
  }

  private heartbeatIntervalMs(): number {
    return Math.max(this.config.paritySync.heartbeatIntervalSeconds, 30) * 1000;
  }

  private commandPollIntervalMs(): number {
    return Math.max(this.config.paritySync.commandPollIntervalSeconds, 30) * 1000;
  }

  private note(enabled: boolean, configured: boolean, active: boolean): string {
    if (!enabled) {
      return "Parity sync is disabled by default.";
    }

    if (!configured) {
      return "Parity sync is enabled but Supabase URL/key are missing or rejected.";
    }

    if (active) {
      return "Parity sync skeleton is active; runtime writes and command processing are disabled.";
    }

    return "Parity sync is configured but idle.";
  }
}

function parseSupabaseUrl(value: string): URL | null {
  try {
    const endpoint = new URL(value.trim());
    if (endpoint.protocol !== "https:") {
      return null;
    }

    endpoint.pathname = "/";
    endpoint.search = "";
    endpoint.hash = "";
    return endpoint;
  } catch {
    return null;
  }
}

function sanitizeStatusText(value: string | null | undefined, maxLength: number): string | null {
  const sanitized = String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, (match) => {
      try {
        const url = new URL(match);
        return `${url.protocol}//${url.host}/[redacted]`;
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return sanitized || null;
}
