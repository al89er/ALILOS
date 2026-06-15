import path from "node:path";
import { chromium, type BrowserContext } from "playwright";
import type { BrowserControllerState, BrowserStatusSnapshot } from "../shared/types";
import type { AppLogger } from "../main/logger";

export class BrowserController {
  private context: BrowserContext | null = null;
  private state: BrowserControllerState = "stopped";
  private lastStartedAt: string | null = null;
  private lastStoppedAt: string | null = null;
  private lastError: string | null = null;
  private startPromise: Promise<BrowserStatusSnapshot> | null = null;
  private stopPromise: Promise<BrowserStatusSnapshot> | null = null;
  private readonly profilePath: string;

  constructor(
    userDataPath: string,
    private readonly logger: AppLogger,
    private readonly onStatusChanged: () => void = () => {}
  ) {
    this.profilePath = path.join(userDataPath, "playwright-profile");
  }

  status(): BrowserStatusSnapshot {
    return {
      state: this.state,
      profilePath: this.profilePath,
      lastStartedAt: this.lastStartedAt,
      lastStoppedAt: this.lastStoppedAt,
      lastError: this.lastError
    };
  }

  async start(): Promise<BrowserStatusSnapshot> {
    if (this.stopPromise) {
      await this.stopPromise;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    if (this.state === "starting") {
      return this.status();
    }

    if (this.context) {
      this.state = "running";
      return this.status();
    }

    this.logger.info("Browser start requested.");
    this.startPromise = this.startBrowser();
    return this.startPromise.finally(() => {
      this.startPromise = null;
    });
  }

  async stop(): Promise<BrowserStatusSnapshot> {
    if (this.startPromise) {
      await this.startPromise;
    }

    if (this.stopPromise) {
      return this.stopPromise;
    }

    if (this.state === "stopping") {
      return this.status();
    }

    if (!this.context) {
      this.state = "stopped";
      return this.status();
    }

    this.logger.info("Browser stop requested.");
    this.stopPromise = this.stopBrowser();
    return this.stopPromise.finally(() => {
      this.stopPromise = null;
    });
  }

  private async startBrowser(): Promise<BrowserStatusSnapshot> {
    this.state = "starting";
    this.lastError = null;
    this.onStatusChanged();

    try {
      this.context = await chromium.launchPersistentContext(this.profilePath, {
        headless: false
      });
      this.context.on("close", () => {
        this.handleContextClosed();
      });
      this.state = "running";
      this.lastStartedAt = new Date().toISOString();
      this.logger.info("Browser started.");
    } catch (error) {
      this.context = null;
      this.state = "error";
      this.lastError = sanitizeError(error);
      this.logger.error(`Browser start error: ${this.lastError}`);
    }

    this.onStatusChanged();
    return this.status();
  }

  private async stopBrowser(): Promise<BrowserStatusSnapshot> {
    this.state = "stopping";
    this.lastError = null;
    this.onStatusChanged();

    try {
      const context = this.context;
      await context?.close();
      this.context = null;
      this.state = "stopped";
      this.lastStoppedAt = new Date().toISOString();
      this.logger.info("Browser stopped.");
    } catch (error) {
      this.state = "error";
      this.lastError = sanitizeError(error);
      this.logger.error(`Browser stop error: ${this.lastError}`);
    }

    this.onStatusChanged();
    return this.status();
  }

  private handleContextClosed(): void {
    if (!this.context) {
      return;
    }

    const wasStopping = this.state === "stopping";
    this.context = null;
    this.state = "stopped";
    this.lastStoppedAt = new Date().toISOString();

    if (!this.stopPromise && !wasStopping) {
      this.logger.info("Browser closed.");
    }

    this.onStatusChanged();
  }
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown browser controller error.";
}
