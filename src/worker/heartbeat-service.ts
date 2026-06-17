import type {
  AppConfig,
  HeartbeatPayload,
  HeartbeatSnapshot
} from "../shared/types";
import type { AppLogger } from "../main/logger";

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
    private readonly buildPayload: () => HeartbeatPayload
  ) {}

  start(): void {
    if (this.timer || !this.config.heartbeat.enabled) {
      return;
    }

    this.logger.info("Heartbeat service started.");
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
    this.logger.info("Heartbeat service stopped.");
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
      configured: Boolean(parseEndpoint(this.config.heartbeat.endpointUrl)),
      active: Boolean(this.timer),
      intervalSeconds: this.config.heartbeat.intervalSeconds,
      endpointHost: endpointHost(this.config.heartbeat.endpointUrl),
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

    const endpoint = parseEndpoint(this.config.heartbeat.endpointUrl);
    const payload = this.buildPayload();
    this.lastPayload = payload;

    if (!this.config.heartbeat.enabled) {
      return this.snapshot();
    }

    if (!endpoint) {
      this.lastError = "Heartbeat endpoint is not configured.";
      this.logger.warn("Heartbeat not sent: endpoint is not configured.");
      return this.snapshot();
    }

    this.inFlight = true;
    this.lastAttemptAt = new Date().toISOString();

    try {
      const response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Heartbeat endpoint returned HTTP ${response.status}.`);
      }

      this.lastSuccessAt = new Date().toISOString();
      this.lastError = null;
      this.logger.info(`Heartbeat sent from ${source} to ${endpoint.host}.`);
    } catch (error) {
      this.lastError = sanitizeError(error);
      this.logger.warn(`Heartbeat failed: ${this.lastError}`);
    } finally {
      this.inFlight = false;
    }

    return this.snapshot();
  }

  private intervalMs(): number {
    return Math.max(this.config.heartbeat.intervalSeconds, 30) * 1000;
  }
}

function parseEndpoint(value: string): URL | null {
  try {
    const endpoint = new URL(value.trim());
    return endpoint.protocol === "https:" || endpoint.protocol === "http:" ? endpoint : null;
  } catch {
    return null;
  }
}

function endpointHost(value: string): string | null {
  return parseEndpoint(value)?.host ?? null;
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown heartbeat error.");
  return raw
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .slice(0, 240);
}

