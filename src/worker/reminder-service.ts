import { Notification } from "electron";
import type {
  AppConfig,
  ReminderDateState,
  ReminderSnapshot,
  ReminderStage,
  ReminderSuppressionReason,
  ScheduleAction,
  ScheduleActionSnapshot,
  ScheduleSnapshot
} from "../shared/types";
import type { ConfigStore } from "../main/config-store";
import type { AppLogger } from "../main/logger";
import type { TelegramService } from "../main/telegram-service";

const CHECK_INTERVAL_MS = 30000;
const NOTIFICATION_STATE_RETENTION_DAYS = 60;

interface ReminderCandidate {
  stage: ReminderStage;
  action: ScheduleActionSnapshot;
  title: string;
  message: string;
}

export class ReminderService {
  private timer: NodeJS.Timeout | null = null;
  private lastCheckedAt: string | null = null;
  private lastNotificationAt: string | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly configStore: ConfigStore,
    private readonly logger: AppLogger,
    private readonly telegramService: TelegramService,
    private readonly getScheduleSnapshot: () => ScheduleSnapshot,
    private readonly broadcastSnapshot: () => void
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.evaluate();
    }, CHECK_INTERVAL_MS);
    void this.evaluate();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  clearLogMarkersForDate(dateKey: string): void {
    const state = this.config.scheduler.notificationsByDate[dateKey];

    if (!state) {
      return;
    }

    state.loggedSuppressions = [];
    state.loggedDuplicates = [];
    this.configStore.save(this.config);
  }

  snapshot(): ReminderSnapshot {
    const today = formatDateKey(new Date());
    const state = this.config.scheduler.notificationsByDate[today];

    return {
      enabled: this.config.scheduler.reminders.enabled,
      active: Boolean(this.timer),
      approachingMinutes: this.config.scheduler.reminders.approachingMinutes,
      sentStagesToday: state?.sentStages ?? [],
      lastCheckedAt: this.lastCheckedAt,
      lastNotificationAt: this.lastNotificationAt,
      lastError: this.lastError
    };
  }

  async evaluate(now = new Date()): Promise<void> {
    this.lastCheckedAt = now.toISOString();
    this.pruneOldNotificationState(now);

    if (!this.config.scheduler.reminders.enabled) {
      this.broadcastSnapshot();
      return;
    }

    const schedule = this.getScheduleSnapshot();
    const state = this.getDateState(schedule.today);

    if (schedule.isWeekend) {
      this.logSuppressionOnce(schedule.today, state, "weekend", "Reminder skipped due to weekend/non-working day.");
      this.broadcastSnapshot();
      return;
    }

    if (schedule.isTodaySkipped) {
      this.logSuppressionOnce(schedule.today, state, "skipped", "Reminder skipped due to skipped date.");
      this.broadcastSnapshot();
      return;
    }

    const candidates = buildReminderCandidates(schedule, now, this.config.scheduler.reminders.approachingMinutes);

    for (const candidate of candidates) {
      if (state.sentStages.includes(candidate.stage)) {
        this.logDuplicateOnce(schedule.today, state, candidate.stage);
        continue;
      }

      state.sentStages.push(candidate.stage);
      this.configStore.save(this.config);
      await this.sendReminder(candidate);
    }

    this.broadcastSnapshot();
  }

  private async sendReminder(candidate: ReminderCandidate): Promise<void> {
    const text = `${candidate.title}\n${candidate.message}`;

    try {
      this.sendSystemNotification(candidate.title, candidate.message);

      if (this.telegramService.isConfigured()) {
        const telegramResult = await this.telegramService.sendNotification(text);

        if (!telegramResult.ok) {
          this.lastError = telegramResult.message;
          this.logger.warn(`Telegram reminder notification failed: ${telegramResult.message}`);
        } else {
          this.lastError = null;
        }
      }

      this.lastNotificationAt = new Date().toISOString();
      this.logger.info(`Reminder sent: ${candidate.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown reminder notification error.";
      this.lastError = message;
      this.logger.error(`Reminder notification failed: ${message}`);
    }
  }

  private sendSystemNotification(title: string, body: string): void {
    if (!this.config.scheduler.reminders.systemNotificationsEnabled || !Notification.isSupported()) {
      return;
    }

    new Notification({ title, body }).show();
  }

  private getDateState(dateKey: string): ReminderDateState {
    const existing = this.config.scheduler.notificationsByDate[dateKey];

    if (existing) {
      existing.sentStages ??= [];
      existing.loggedSuppressions ??= [];
      existing.loggedDuplicates ??= [];
      return existing;
    }

    const nextState: ReminderDateState = {
      sentStages: [],
      loggedSuppressions: [],
      loggedDuplicates: []
    };

    this.config.scheduler.notificationsByDate[dateKey] = nextState;
    this.configStore.save(this.config);
    return nextState;
  }

  private logSuppressionOnce(
    dateKey: string,
    state: ReminderDateState,
    reason: ReminderSuppressionReason,
    message: string
  ): void {
    if (state.loggedSuppressions.includes(reason)) {
      return;
    }

    state.loggedSuppressions.push(reason);
    this.configStore.save(this.config);
    this.logger.info(`${message} Date: ${dateKey}.`);
  }

  private logDuplicateOnce(dateKey: string, state: ReminderDateState, stage: ReminderStage): void {
    if (state.loggedDuplicates.includes(stage)) {
      return;
    }

    state.loggedDuplicates.push(stage);
    this.configStore.save(this.config);
    this.logger.info(`Duplicate reminder suppressed for ${stage} on ${dateKey}.`);
  }

  private pruneOldNotificationState(now: Date): void {
    const cutoff = startOfLocalDay(now);
    cutoff.setDate(cutoff.getDate() - NOTIFICATION_STATE_RETENTION_DAYS);
    let changed = false;

    for (const dateKey of Object.keys(this.config.scheduler.notificationsByDate)) {
      if (dateTimeFromKey(dateKey, "00:00") < cutoff) {
        delete this.config.scheduler.notificationsByDate[dateKey];
        changed = true;
      }
    }

    if (changed) {
      this.configStore.save(this.config);
      this.logger.info(`Pruned reminder notification state older than ${NOTIFICATION_STATE_RETENTION_DAYS} days.`);
    }
  }
}

function buildReminderCandidates(
  schedule: ScheduleSnapshot,
  now: Date,
  approachingMinutes: number
): ReminderCandidate[] {
  return schedule.actions.flatMap((action) => {
    const scheduledAt = dateTimeFromKey(schedule.today, action.time);
    const approachingAt = new Date(scheduledAt.getTime() - approachingMinutes * 60 * 1000);
    const stage = getStageForAction(action, now, scheduledAt, approachingAt);

    if (!stage) {
      return [];
    }

    return [{
      stage,
      action,
      title: `A.L.I.L.O.S. ${action.label} Reminder`,
      message: buildReminderMessage(action, stage, schedule.today)
    }];
  });
}

function getStageForAction(
  action: ScheduleActionSnapshot,
  now: Date,
  scheduledAt: Date,
  approachingAt: Date
): ReminderStage | null {
  if (now >= approachingAt && now < scheduledAt) {
    return stageFor(action.action, "approaching");
  }

  if (action.status === "due-now") {
    return stageFor(action.action, "due");
  }

  if (action.status === "within-grace-period") {
    return stageFor(action.action, "grace");
  }

  return null;
}

function stageFor(action: ScheduleAction, stage: "approaching" | "due" | "grace"): ReminderStage {
  const prefix = action === "clock-in" ? "clockIn" : "clockOut";

  switch (stage) {
    case "approaching":
      return `${prefix}Approaching` as ReminderStage;
    case "due":
      return `${prefix}DueNow` as ReminderStage;
    case "grace":
      return `${prefix}Grace` as ReminderStage;
  }
}

function buildReminderMessage(action: ScheduleActionSnapshot, stage: ReminderStage, dateKey: string): string {
  const stageText = reminderStageText(stage);
  return `${action.label} ${stageText}. Scheduled time: ${action.time}. Date: ${dateKey}. Manual confirmation only.`;
}

function reminderStageText(stage: ReminderStage): string {
  switch (stage) {
    case "clockInApproaching":
    case "clockOutApproaching":
      return "is approaching";
    case "clockInDueNow":
    case "clockOutDueNow":
      return "is due now";
    case "clockInGrace":
    case "clockOutGrace":
      return "is within the grace period";
  }
}

function dateTimeFromKey(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}
