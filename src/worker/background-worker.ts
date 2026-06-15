import { EventEmitter } from "node:events";
import type { AppConfig } from "../shared/types";
import type { AppLogger } from "../main/logger";

export class BackgroundWorker extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private state: "idle" | "running" | "stopped" = "idle";
  private lastStartedAt: string | null = null;
  private lastHeartbeatAt: string | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger
  ) {
    super();
  }

  start(): void {
    if (this.state === "running") {
      return;
    }

    this.state = "running";
    this.lastStartedAt = new Date().toISOString();
    this.logger.info("Background worker scaffold started.");
    this.scheduleHeartbeat();
    this.emit("updated");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.state = "stopped";
    this.logger.info("Background worker scaffold stopped.");
    this.emit("updated");
  }

  snapshot() {
    return {
      state: this.state,
      lastStartedAt: this.lastStartedAt,
      lastHeartbeatAt: this.lastHeartbeatAt,
      note: "Scaffold only. No Perakam Waktu clicking or captive portal login is implemented."
    };
  }

  private scheduleHeartbeat(): void {
    const intervalMs = Math.max(this.config.worker.pollIntervalSeconds, 15) * 1000;
    this.lastHeartbeatAt = new Date().toISOString();

    this.timer = setInterval(() => {
      this.lastHeartbeatAt = new Date().toISOString();
      this.logger.info("Background worker heartbeat.");
      this.emit("updated");
    }, intervalMs);
  }
}
