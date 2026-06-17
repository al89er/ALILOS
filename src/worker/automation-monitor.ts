import { Notification } from "electron";
import type { ConfigStore } from "../main/config-store";
import type { AppLogger } from "../main/logger";
import type { TelegramService } from "../main/telegram-service";
import { appendAutomationAuditEvent, hasAutomationAuditEvent } from "./automation-audit";
import type {
  AppConfig,
  AttendanceActionType,
  AttendanceControlAvailability,
  AutomationDryRunRecord,
  AutomationSnapshot,
  BrowserStatusSnapshot,
  PerakamStatusSnapshot,
  ScheduleActionSnapshot,
  ScheduleSnapshot
} from "../shared/types";

const READY_STATUSES = ["due-now", "within-grace-period"] as const;

interface AutomationMonitorSources {
  getScheduleSnapshot: () => ScheduleSnapshot;
  getBrowserStatus: () => BrowserStatusSnapshot;
  getPerakamStatus: () => PerakamStatusSnapshot;
  openPerakam: () => Promise<PerakamStatusSnapshot>;
  refreshPerakamStatus: () => Promise<PerakamStatusSnapshot>;
  publishHeartbeat: (source: string) => Promise<void>;
  broadcastSnapshot: () => void;
}

export class AutomationMonitor {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private lastCheckedAt: string | null = null;
  private latestDryRun: AutomationDryRunRecord | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly configStore: ConfigStore,
    private readonly logger: AppLogger,
    private readonly telegramService: TelegramService,
    private readonly sources: AutomationMonitorSources
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.logger.info("Automation monitor started.");
    this.timer = setInterval(() => {
      void this.evaluate("interval");
    }, this.intervalMs());
    void this.evaluate("startup");
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    this.logger.info("Automation monitor stopped.");
  }

  configure(): void {
    this.stop();
    this.start();
  }

  snapshot(): AutomationSnapshot {
    return {
      executionMode: this.config.automation.executionMode,
      active: Boolean(this.timer),
      monitorIntervalSeconds: this.config.automation.monitorIntervalSeconds,
      prepareBrowserInDryRun: this.config.automation.prepareBrowserInDryRun,
      lastCheckedAt: this.lastCheckedAt,
      latestDryRun: this.latestDryRun,
      auditEvents: [...this.config.automation.auditEvents].slice(-20).reverse()
    };
  }

  async evaluate(source = "manual"): Promise<AutomationSnapshot> {
    if (this.inFlight) {
      return this.snapshot();
    }

    this.inFlight = true;
    this.lastCheckedAt = new Date().toISOString();

    try {
      const schedule = this.sources.getScheduleSnapshot();
      const dueActions = schedule.actions.filter(isReadyAction);

      for (const action of dueActions) {
        await this.processDueAction(schedule, action, source);
      }
    } catch (error) {
      this.logger.warn(`Automation monitor check failed: ${sanitizeError(error)}`);
    } finally {
      this.inFlight = false;
      this.sources.broadcastSnapshot();
    }

    return this.snapshot();
  }

  private async processDueAction(
    schedule: ScheduleSnapshot,
    action: ScheduleActionSnapshot,
    source: string
  ): Promise<void> {
    if (!hasAutomationAuditEvent(this.config, {
      type: "schedule-due",
      action: action.action,
      dateKey: schedule.today
    })) {
      appendAutomationAuditEvent(this.config, this.configStore, this.logger, {
        type: "schedule-due",
        action: action.action,
        dateKey: schedule.today,
        message: `${action.label} reached ${action.statusText.toLowerCase()} in ${this.config.automation.executionMode} mode.`,
        details: {
          scheduledTime: action.time,
          source
        }
      });
    }

    if (this.config.automation.executionMode === "notify-only") {
      return;
    }

    if (this.config.automation.executionMode === "manual-confirm") {
      this.recordConfirmationRequired(schedule, action, "Manual confirmation mode requires user approval before any real configured-target click.");
      return;
    }

    await this.runDryRunSimulation(schedule, action, source);
  }

  private async runDryRunSimulation(
    schedule: ScheduleSnapshot,
    action: ScheduleActionSnapshot,
    source: string
  ): Promise<void> {
    if (hasAutomationAuditEvent(this.config, {
      type: "dry-run-action-simulated",
      action: action.action,
      dateKey: schedule.today
    })) {
      return;
    }

    let perakam = this.sources.getPerakamStatus();

    try {
      if (this.config.automation.prepareBrowserInDryRun) {
        perakam = this.sources.getBrowserStatus().state === "running" && perakam.currentUrl
          ? await this.sources.refreshPerakamStatus()
          : await this.sources.openPerakam();
      } else {
        perakam = await this.sources.refreshPerakamStatus();
      }

      appendAutomationAuditEvent(this.config, this.configStore, this.logger, {
        type: "page-prepared",
        action: action.action,
        dateKey: schedule.today,
        status: "passed",
        message: `Perakam page prepared for simulated ${action.action}.`,
        details: {
          perakamStatus: perakam.status,
          browserState: this.sources.getBrowserStatus().state,
          source
        }
      });
    } catch (error) {
      perakam = this.sources.getPerakamStatus();
      this.recordDryRunResult(schedule, action, perakam, "failed", `Page preparation failed: ${sanitizeError(error)}`);
      return;
    }

    const controlAvailability = controlAvailabilityFor(action.action, perakam);
    if (controlAvailability === "available") {
      appendAutomationAuditEvent(this.config, this.configStore, this.logger, {
        type: "candidate-detected",
        action: action.action,
        dateKey: schedule.today,
        status: "passed",
        message: `Candidate ${targetIdFor(action.action)} detected for simulated ${action.action}.`,
        details: {
          targetId: targetIdFor(action.action),
          perakamStatus: perakam.status,
          source
        }
      });
      this.recordDryRunResult(schedule, action, perakam, "simulated", `Simulated ${action.action}; ${targetIdFor(action.action)} was available. No click was performed.`);
      return;
    }

    this.recordDryRunResult(
      schedule,
      action,
      perakam,
      "blocked",
      `Simulated ${action.action} blocked; ${targetIdFor(action.action)} was ${controlAvailability}. No click was performed.`
    );
  }

  private recordDryRunResult(
    schedule: ScheduleSnapshot,
    action: ScheduleActionSnapshot,
    perakam: PerakamStatusSnapshot,
    status: AutomationDryRunRecord["status"],
    reason: string
  ): void {
    const event = appendAutomationAuditEvent(this.config, this.configStore, this.logger, {
      type: "dry-run-action-simulated",
      action: action.action,
      dateKey: schedule.today,
      status: status === "simulated" ? "passed" : status,
      message: reason,
      details: {
        scheduledTime: action.time,
        targetId: targetIdFor(action.action),
        perakamStatus: perakam.status,
        controlAvailability: controlAvailabilityFor(action.action, perakam),
        simulatedOnly: true
      }
    });

    this.latestDryRun = {
      action: action.action,
      dateKey: schedule.today,
      scheduledTime: action.time,
      status,
      perakamStatus: perakam.status,
      controlAvailability: controlAvailabilityFor(action.action, perakam),
      reason,
      simulatedAt: event.createdAt,
      auditEventId: event.id
    };

    this.recordConfirmationRequired(schedule, action, "Real attendance still requires explicit confirmation.");
    void this.notifyDryRun(this.latestDryRun);
    void this.sources.publishHeartbeat("automation-dry-run");
  }

  private recordConfirmationRequired(
    schedule: ScheduleSnapshot,
    action: ScheduleActionSnapshot,
    message: string
  ): void {
    if (hasAutomationAuditEvent(this.config, {
      type: "confirmation-required",
      action: action.action,
      dateKey: schedule.today
    })) {
      return;
    }

    appendAutomationAuditEvent(this.config, this.configStore, this.logger, {
      type: "confirmation-required",
      action: action.action,
      dateKey: schedule.today,
      status: "blocked",
      message,
      details: {
        scheduledTime: action.time,
        executionMode: this.config.automation.executionMode
      }
    });
  }

  private async notifyDryRun(record: AutomationDryRunRecord): Promise<void> {
    const title = `A.L.I.L.O.S. simulated ${record.action}`;
    const body = `${record.reason} Date: ${record.dateKey}. Scheduled: ${record.scheduledTime}.`;

    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }

    if (!this.config.telegram.enabled) {
      return;
    }

    const telegramResult = await this.telegramService.sendNotification(`${title}\n${body}`);
    if (!telegramResult.ok && !telegramResult.message.includes("Telegram is disabled")) {
      this.logger.warn(`Telegram dry-run notification failed: ${telegramResult.message}`);
    }
  }

  private intervalMs(): number {
    return Math.max(this.config.automation.monitorIntervalSeconds, 15) * 1000;
  }
}

function isReadyAction(action: ScheduleActionSnapshot): boolean {
  return READY_STATUSES.includes(action.status as typeof READY_STATUSES[number]);
}

function controlAvailabilityFor(
  action: AttendanceActionType,
  perakam: PerakamStatusSnapshot
): AttendanceControlAvailability {
  return action === "clock-in" ? perakam.clockInAvailable : perakam.clockOutAvailable;
}

function targetIdFor(action: AttendanceActionType): "a50" | "a51" {
  return action === "clock-in" ? "a50" : "a51";
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown automation monitor error.");
  return raw
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .slice(0, 240);
}
