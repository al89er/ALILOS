import type {
  AppConfig,
  HeartbeatPayload,
  HeartbeatSnapshot
} from "../shared/types";
import type { AppLogger } from "../main/logger";
import type { EnvLocalSupabaseSettings } from "../main/config-store";

interface SupabaseHeartbeatSettings {
  deviceId: string;
  deviceLabel: string;
  supabaseUrl: URL;
  publishableKey: string;
}

export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private lastAttemptAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;
  private lastPayload: HeartbeatPayload | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    private readonly buildPayload: () => HeartbeatPayload,
    private readonly envLocal: EnvLocalSupabaseSettings,
    private readonly appVersion: string
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    if (!this.config.heartbeat.enabled) {
      this.lastError = null;
      this.logger.info("Supabase heartbeat disabled; local scheduling continues.");
      return;
    }

    if (!this.effectiveSettings()) {
      this.lastError = null;
      this.logger.info("Supabase heartbeat not configured; local scheduling continues.");
      return;
    }

    this.logger.info("Supabase heartbeat service started.");
    this.timer = setInterval(() => {
      void this.send("interval");
    }, this.intervalMs());
    void this.send("startup");
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    this.logger.info("Supabase heartbeat service stopped.");
  }

  configure(): void {
    this.stop();

    if (this.config.heartbeat.enabled) {
      this.start();
    }
  }

  snapshot(): HeartbeatSnapshot {
    return {
      enabled: this.config.heartbeat.enabled,
      configured: Boolean(this.effectiveSettings()),
      active: Boolean(this.timer),
      intervalSeconds: this.config.heartbeat.intervalSeconds,
      endpointHost: this.effectiveSettings()?.supabaseUrl.host ?? null,
      keyStatus: this.keyStatus(),
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      lastPayload: this.lastPayload
    };
  }

  async send(source = "manual"): Promise<HeartbeatSnapshot> {
    if (this.inFlight) {
      return this.snapshot();
    }

    if (!this.config.heartbeat.enabled) {
      return this.snapshot();
    }

    const settings = this.effectiveSettings();
    if (!settings) {
      this.lastError = null;
      this.logger.info("Supabase heartbeat not sent: URL or publishable key is not configured.");
      return this.snapshot();
    }

    const payload = this.buildPayload();
    this.lastPayload = payload;
    this.inFlight = true;
    this.lastAttemptAt = new Date().toISOString();

    try {
      await this.upsertDevice(settings, payload);
      await this.upsertHeartbeat(settings, payload);

      this.lastSuccessAt = new Date().toISOString();
      this.lastError = null;
      this.logger.info(`Supabase heartbeat sent from ${source} to ${settings.supabaseUrl.host}.`);
    } catch (error) {
      this.lastError = sanitizeError(error);
      this.logger.warn(`Supabase heartbeat failed: ${this.lastError}`);
    } finally {
      this.inFlight = false;
    }

    return this.snapshot();
  }

  private async upsertDevice(settings: SupabaseHeartbeatSettings, payload: HeartbeatPayload): Promise<void> {
    await this.upsert(settings, "devices", {
      device_id: settings.deviceId,
      display_name: settings.deviceLabel,
      platform: process.platform,
      app_version: this.appVersion,
      is_active: true,
      last_seen_at: payload.lastSeenAt,
      updated_at: payload.lastSeenAt
    });
  }

  private async upsertHeartbeat(settings: SupabaseHeartbeatSettings, payload: HeartbeatPayload): Promise<void> {
    await this.upsert(settings, "heartbeats", {
      device_id: settings.deviceId,
      app_status: payload.appStatus,
      network_status: payload.networkStatus,
      perakam_page_status: payload.perakamPageStatus,
      telegram_status: payload.telegramStatus,
      last_seen_at: payload.lastSeenAt,
      status_text: payload.statusText,
      last_error_text: payload.lastErrorText,
      updated_at: payload.lastSeenAt
    });
  }

  private async upsert(settings: SupabaseHeartbeatSettings, tableName: "devices" | "heartbeats", row: Record<string, unknown>): Promise<void> {
    const endpoint = new URL(`/rest/v1/${tableName}`, settings.supabaseUrl);
    endpoint.searchParams.set("on_conflict", "device_id");

    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        "apikey": settings.publishableKey,
        "Authorization": `Bearer ${settings.publishableKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      throw new Error(`Supabase ${tableName} upsert returned HTTP ${response.status}.`);
    }
  }

  private intervalMs(): number {
    return Math.max(this.config.heartbeat.intervalSeconds, 30) * 1000;
  }

  private effectiveSettings(): SupabaseHeartbeatSettings | null {
    const configuredUrl = this.config.heartbeat.supabaseUrl.trim();
    const supabaseUrl = parseSupabaseUrl(configuredUrl || this.envLocal.supabaseUrl);
    const publishableKey = (this.config.heartbeat.publishableKey.trim() || this.envLocal.publishableKey.trim()).trim();

    if (!supabaseUrl || !publishableKey || looksLikeSecretKey(publishableKey)) {
      return null;
    }

    return {
      deviceId: this.config.heartbeat.deviceId,
      deviceLabel: sanitizeText(this.config.heartbeat.deviceLabel || "A.L.I.L.O.S. desktop", 120) ?? "A.L.I.L.O.S. desktop",
      supabaseUrl,
      publishableKey
    };
  }

  private keyStatus(): HeartbeatSnapshot["keyStatus"] {
    if (this.config.heartbeat.publishableKey.trim()) {
      return "configured";
    }

    if (this.envLocal.publishableKey.trim()) {
      return "env-local";
    }

    return "missing";
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

function looksLikeSecretKey(value: string): boolean {
  if (value.startsWith("sb_secret_")) {
    return true;
  }

  const parts = value.split(".");
  if (parts.length < 2) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown heartbeat error.");
  return raw
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/apikey['":\s]+[A-Za-z0-9._-]+/gi, "apikey [redacted]")
    .slice(0, 240);
}

function sanitizeText(value: string | null | undefined, maxLength: number): string | null {
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
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return sanitized || null;
}
