import type {
  AppConfig,
  ParityCommandStatus,
  ParityCommandType,
  ParityDeviceStatusPayload,
  ParityEventLogPayload,
  ParitySyncSnapshot
} from "../shared/types";
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

interface ParitySyncRequestBody {
  deviceStatus: ParityDeviceStatusPayload;
  events: ParityEventLogPayload[];
}

interface ParitySyncDependencies {
  buildDeviceStatusPayload: () => ParityDeviceStatusPayload;
  fetchFn?: typeof fetch;
}

export class ParitySyncService {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private lastStartedAt: string | null = null;
  private lastStoppedAt: string | null = null;
  private lastCheckedAt: string | null = null;
  private lastAttemptAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;
  private publishCount = 0;
  private failureCount = 0;
  private hasLoggedDisabled = false;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    private readonly envLocal: EnvLocalSupabaseSettings,
    private readonly dependencies: ParitySyncDependencies
  ) {}

  start(): void {
    if (this.heartbeatTimer) {
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
    this.logger.info("Supabase parity status publisher started. Command processing remains disabled.");

    this.heartbeatTimer = setInterval(() => {
      void this.publishStatus("interval");
    }, this.heartbeatIntervalMs());

    void this.publishStatus("startup");
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
    const active = Boolean(this.heartbeatTimer);
    const enabled = this.config.paritySync.enabled;
    const configured = Boolean(effectiveSettings);

    return {
      enabled,
      configured,
      active,
      health: !enabled ? "disabled" : configured ? this.lastError ? "error" : active ? "active" : "idle" : "not-configured",
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
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      publishCount: this.publishCount,
      failureCount: this.failureCount,
      note: this.note(enabled, configured, active)
    };
  }

  async publishStatus(source = "manual"): Promise<ParitySyncSnapshot> {
    if (this.inFlight) {
      return this.getStatus();
    }

    if (!this.config.paritySync.enabled) {
      return this.getStatus();
    }

    const settings = this.effectiveSettings();
    if (!settings) {
      this.lastError = null;
      this.logger.info("Supabase parity status not sent: URL or publishable key is not configured.");
      return this.getStatus();
    }

    this.inFlight = true;
    this.lastAttemptAt = new Date().toISOString();
    this.lastCheckedAt = this.lastAttemptAt;

    try {
      const body = this.buildRequestBody(source);
      await this.publish(settings, body);
      this.lastSuccessAt = new Date().toISOString();
      this.publishCount += 1;
      this.lastError = null;
      this.logger.info(`Supabase parity status published from ${source} to ${settings.supabaseUrl.host}.`);
    } catch (error) {
      this.failureCount += 1;
      this.lastError = sanitizeError(error);
      this.logger.warn(`Supabase parity status publish failed: ${this.lastError}`);
    } finally {
      this.inFlight = false;
    }

    return this.getStatus();
  }

  private logDisabledOnce(): void {
    if (this.hasLoggedDisabled) {
      return;
    }

    this.hasLoggedDisabled = true;
    this.logger.info("Supabase parity sync disabled; no runtime publishing or command processing.");
  }

  private buildRequestBody(source: string): ParitySyncRequestBody {
    const deviceStatus = sanitizeDeviceStatusPayload(this.dependencies.buildDeviceStatusPayload());
    const events = this.config.paritySync.logUploadEnabled
      ? [buildStatusEvent(deviceStatus, source)].map(sanitizeEventPayload).filter((event): event is ParityEventLogPayload => Boolean(event))
      : [];

    return { deviceStatus, events };
  }

  private async publish(settings: EffectiveParitySyncSettings, body: ParitySyncRequestBody): Promise<void> {
    const endpoint = new URL("/functions/v1/alilos-parity-status", settings.supabaseUrl);
    const fetchFn = this.dependencies.fetchFn ?? fetch;
    const response = await fetchFn(endpoint.toString(), {
      method: "POST",
      headers: {
        "apikey": settings.publishableKey,
        "Authorization": `Bearer ${settings.publishableKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Supabase parity status proxy returned HTTP ${response.status}.`);
    }
  }

  private effectiveSettings(): EffectiveParitySyncSettings | null {
    const supabaseUrl = parseSupabaseUrl(this.config.paritySync.supabaseUrl.trim() || this.envLocal.supabaseUrl.trim());
    const publishableKey = (this.config.paritySync.publishableKey.trim() || this.envLocal.publishableKey.trim()).trim();

    if (!supabaseUrl || !publishableKey || looksLikeSupabaseServiceRoleKey(publishableKey) || !isValidDeviceId(this.config.paritySync.deviceId)) {
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

    if (this.lastError) {
      return "Last parity status publish failed; local desktop operation continues.";
    }

    if (active) {
      return "Parity status publishing is active; command processing remains disabled.";
    }

    return "Parity sync is configured but idle.";
  }
}

function buildStatusEvent(payload: ParityDeviceStatusPayload, source: string): ParityEventLogPayload {
  return {
    deviceId: payload.deviceId,
    eventTime: payload.recordedAt,
    eventType: "desktop-status",
    severity: "info",
    actionKey: null,
    scheduleDate: null,
    message: "Parity status heartbeat generated.",
    details: {
      source: sanitizeStatusText(source, 80),
      syncHealth: payload.syncHealth,
      executionMode: payload.executionMode,
      browserState: payload.browserState,
      configuredSiteStatus: payload.configuredSiteStatus,
      captivePortalStatus: payload.captivePortalStatus,
      commandProcessing: false,
      directTableWrite: false
    }
  };
}

function sanitizeDeviceStatusPayload(payload: ParityDeviceStatusPayload): ParityDeviceStatusPayload {
  return {
    deviceId: sanitizeUuidLike(payload.deviceId),
    deviceLabel: sanitizeStatusText(payload.deviceLabel, 120) ?? "A.L.I.L.O.S. desktop",
    appVersion: sanitizeStatusText(payload.appVersion, 80) ?? "unknown",
    appStatus: sanitizeStatusText(payload.appStatus, 80) ?? "unknown",
    workerState: payload.workerState,
    executionMode: payload.executionMode,
    networkStatus: sanitizeStatusText(payload.networkStatus, 120) ?? "unknown",
    captivePortalStatus: payload.captivePortalStatus,
    configuredSiteStatus: payload.configuredSiteStatus,
    browserState: payload.browserState,
    syncHealth: payload.syncHealth,
    nextActionStatus: payload.nextActionStatus,
    nextScheduleSummary: sanitizeStatusText(payload.nextScheduleSummary, 240),
    completionSummary: sanitizeStatusText(payload.completionSummary, 240),
    lastErrorText: sanitizeStatusText(payload.lastErrorText, 500),
    recordedAt: sanitizeIsoText(payload.recordedAt)
  };
}

function sanitizeEventPayload(payload: ParityEventLogPayload): ParityEventLogPayload | null {
  const message = sanitizeStatusText(payload.message, 500);
  if (!message) {
    return null;
  }

  return {
    deviceId: sanitizeUuidLike(payload.deviceId),
    eventTime: sanitizeIsoText(payload.eventTime),
    eventType: payload.eventType,
    severity: payload.severity,
    actionKey: payload.actionKey === "clock-in" || payload.actionKey === "clock-out" ? payload.actionKey : null,
    scheduleDate: sanitizeDateText(payload.scheduleDate),
    message,
    details: sanitizeDetails(payload.details)
  };
}

function sanitizeDetails(details: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(details).slice(0, 20)) {
    const normalizedKey = key.trim();
    if (!normalizedKey || FORBIDDEN_DETAIL_KEYS.has(normalizedKey.toLowerCase())) {
      continue;
    }

    if (typeof value === "string") {
      sanitized[normalizedKey.slice(0, 80)] = sanitizeStatusText(value, 160);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[normalizedKey.slice(0, 80)] = value;
    }
  }

  return sanitized;
}

const FORBIDDEN_DETAIL_KEYS = new Set([
  "credential",
  "credentials",
  "password",
  "cookie",
  "cookies",
  "html",
  "raw_html",
  "screenshot",
  "url",
  "urls",
  "full_url",
  "token",
  "tokens",
  "link",
  "magic",
  "4tredir",
  "selector",
  "selectors",
  "script",
  "scripts",
  "form",
  "forms"
]);

function sanitizeUuidLike(value: string): string {
  const text = String(value ?? "").trim();
  return isValidDeviceId(text)
    ? text
    : "00000000-0000-4000-8000-000000000000";
}

function isValidDeviceId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
}

function sanitizeIsoText(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function sanitizeDateText(value: string | null): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
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
    .replace(/link=[^\s&]+/gi, "[redacted-link]")
    .replace(/magic=[^\s&]+/gi, "[redacted-magic]")
    .replace(/4Tredir=[^\s&]+/gi, "[redacted-redirect]")
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/apikey['":\s]+[A-Za-z0-9._-]+/gi, "apikey [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return sanitized || null;
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown parity sync error.");
  return sanitizeStatusText(raw, 240) ?? "Unknown parity sync error.";
}
