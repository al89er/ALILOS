import type {
  AppConfig,
  DailySchedule,
  SchedulerRemoteSkipInput,
  SchedulerRemoteSkipMergeResult,
  SchedulerSkippedDateDetail,
  ScheduleAction,
  ScheduleActionSnapshot,
  ScheduleActionStatus,
  ScheduleSnapshot,
  TimeWindow
} from "../shared/types";
import type { ConfigStore } from "../main/config-store";
import type { AppLogger } from "../main/logger";

const DUE_NOW_WINDOW_MS = 60 * 1000;

export class Scheduler {
  private readonly reusedDates = new Set<string>();
  private readonly lastStatuses = new Map<string, ScheduleActionStatus>();

  constructor(
    private readonly config: AppConfig,
    private readonly configStore: ConfigStore,
    private readonly logger: AppLogger
  ) {}

  getSnapshot(now = new Date()): ScheduleSnapshot {
    const today = formatDateKey(now);
    const schedule = this.getOrCreateSchedule(today, now);
    const isWeekend = isWeekendDate(now);
    const isTodaySkipped = this.config.scheduler.skippedDates.includes(today);
    const actions = this.buildActionSnapshots(schedule, now, isWeekend, isTodaySkipped);

    this.logStatusTransitions(today, actions);

    return {
      today,
      isWeekend,
      isTodaySkipped,
      gracePeriodMinutes: this.config.scheduler.gracePeriodMinutes,
      schedule,
      actions,
      skippedDates: [...this.config.scheduler.skippedDates].sort(),
      skippedDateDetails: this.skippedDateDetails(),
      summary: buildSummary(isWeekend, isTodaySkipped, actions)
    };
  }

  skipToday(): void {
    this.skipDate(formatDateKey(new Date()));
  }

  unskipToday(): void {
    this.unskipDate(formatDateKey(new Date()));
  }

  skipTomorrow(): void {
    this.skipDate(formatDateKey(addDays(new Date(), 1)));
  }

  unskipTomorrow(): void {
    this.unskipDate(formatDateKey(addDays(new Date(), 1)));
  }

  skipDateKey(dateKey: string): boolean {
    return this.skipDate(dateKey, "local");
  }

  unskipDateKey(dateKey: string): boolean {
    return this.unskipDate(dateKey);
  }

  mergeRemoteSkippedDates(dateKeys: string[]): number {
    return this.applyRemoteSkippedDates(dateKeys.map((skipDate) => ({
      skipDate,
      actionKey: null,
      source: "manual-import" as const
    }))).added;
  }

  applyRemoteSkippedDates(remoteSkips: SchedulerRemoteSkipInput[]): SchedulerRemoteSkipMergeResult {
    const now = new Date().toISOString();
    const current = new Set(this.config.scheduler.skippedDates);
    const remoteByDate = new Map<string, SchedulerRemoteSkipInput>();

    for (const remoteSkip of remoteSkips) {
      if (!isDateKey(remoteSkip.skipDate)) {
        continue;
      }

      const existing = remoteByDate.get(remoteSkip.skipDate);
      remoteByDate.set(remoteSkip.skipDate, {
        skipDate: remoteSkip.skipDate,
        actionKey: existing?.actionKey ?? remoteSkip.actionKey,
        source: remoteSkip.source
      });
    }

    let added = 0;
    let remoteRemovalsApplied = 0;
    let remoteRemovalsPreserved = 0;

    for (const remoteSkip of remoteByDate.values()) {
      const existingMetadata = this.config.scheduler.skipMetadataByDate[remoteSkip.skipDate];
      if (!current.has(remoteSkip.skipDate)) {
        current.add(remoteSkip.skipDate);
        added += 1;
        this.config.scheduler.skipMetadataByDate[remoteSkip.skipDate] = {
          source: "remote-managed",
          scope: "whole-day",
          actionKey: remoteSkip.actionKey,
          remoteSource: remoteSkip.source,
          lastSeenRemoteAt: now,
          updatedAt: now
        };
        continue;
      }

      this.config.scheduler.skipMetadataByDate[remoteSkip.skipDate] = {
        source: existingMetadata?.source ?? "unknown-legacy",
        scope: "whole-day",
        actionKey: remoteSkip.actionKey ?? existingMetadata?.actionKey ?? null,
        remoteSource: remoteSkip.source,
        lastSeenRemoteAt: now,
        updatedAt: now
      };
    }

    for (const [dateKey, metadata] of Object.entries(this.config.scheduler.skipMetadataByDate)) {
      if (!isDateKey(dateKey) || remoteByDate.has(dateKey)) {
        continue;
      }

      const isRemoteOwned = metadata.source === "remote-managed" || metadata.source === "uploaded-synced";
      if (isRemoteOwned) {
        if (current.delete(dateKey)) {
          remoteRemovalsApplied += 1;
        }
        delete this.config.scheduler.skipMetadataByDate[dateKey];
        continue;
      }

      if (metadata.lastSeenRemoteAt) {
        remoteRemovalsPreserved += 1;
        this.config.scheduler.skipMetadataByDate[dateKey] = {
          ...metadata,
          remoteSource: null,
          lastSeenRemoteAt: null,
          updatedAt: now
        };
      }
    }

    this.config.scheduler.skippedDates = [...current].sort();

    if (added > 0 || remoteRemovalsApplied > 0 || remoteRemovalsPreserved > 0) {
      this.configStore.save(this.config);
      this.logger.info(`Supabase remote skip sync applied ${added} add(s), ${remoteRemovalsApplied} removal(s), and preserved ${remoteRemovalsPreserved} local-only skip(s). Scheduling state only; no configured-site action was attempted.`);
    }

    return { added, remoteRemovalsApplied, remoteRemovalsPreserved };
  }

  markSkipDateUploaded(dateKey: string): void {
    if (!isDateKey(dateKey) || !this.config.scheduler.skippedDates.includes(dateKey)) {
      return;
    }

    const now = new Date().toISOString();
    const current = this.config.scheduler.skipMetadataByDate[dateKey];
    this.config.scheduler.skipMetadataByDate[dateKey] = {
      source: "uploaded-synced",
      scope: "whole-day",
      actionKey: current?.actionKey ?? null,
      remoteSource: "desktop-local",
      lastSeenRemoteAt: now,
      updatedAt: now
    };
    this.configStore.save(this.config);
  }

  clearRemoteSkipMetadata(dateKey: string): void {
    if (!isDateKey(dateKey)) {
      return;
    }

    delete this.config.scheduler.skipMetadataByDate[dateKey];
    this.configStore.save(this.config);
  }

  recalculateToday(): DailySchedule {
    const today = formatDateKey(new Date());
    delete this.config.scheduler.schedulesByDate[today];
    this.reusedDates.delete(today);
    this.lastStatuses.delete(`${today}:clock-in`);
    this.lastStatuses.delete(`${today}:clock-out`);
    const schedule = this.getOrCreateSchedule(today, new Date());
    this.logger.info(`Recalculated action schedule for ${today} from configured windows. No Perakam action was attempted.`);
    return schedule;
  }

  private getOrCreateSchedule(dateKey: string, now: Date): DailySchedule {
    const existing = this.config.scheduler.schedulesByDate[dateKey];

    if (existing) {
      if (!this.reusedDates.has(dateKey)) {
        this.reusedDates.add(dateKey);
        this.logger.info(`Reused existing action schedule for ${dateKey}.`);
      }

      return existing;
    }

    const schedule: DailySchedule = {
      date: dateKey,
      clockInTime: randomTimeInWindow(dateKey, this.config.scheduler.clockInWindow),
      clockOutTime: randomTimeInWindow(dateKey, this.config.scheduler.clockOutWindow),
      generatedAt: now.toISOString()
    };

    this.config.scheduler.schedulesByDate[dateKey] = schedule;
    this.configStore.save(this.config);
    this.logger.info(
      `Generated action schedule for ${dateKey}: morning ${schedule.clockInTime}, evening ${schedule.clockOutTime}.`
    );

    return schedule;
  }

  private buildActionSnapshots(
    schedule: DailySchedule,
    now: Date,
    isWeekend: boolean,
    isTodaySkipped: boolean
  ): ScheduleActionSnapshot[] {
    const actions: Array<{
      action: ScheduleAction;
      label: "Morning Action" | "Evening Action";
      time: string;
      status: ScheduleActionStatus;
    }> = [
      {
        action: "clock-in",
        label: "Morning Action",
        time: schedule.clockInTime,
        status: getActionStatus(schedule.date, schedule.clockInTime, now, isWeekend, isTodaySkipped, this.config.scheduler.gracePeriodMinutes)
      },
      {
        action: "clock-out",
        label: "Evening Action",
        time: schedule.clockOutTime,
        status: getActionStatus(schedule.date, schedule.clockOutTime, now, isWeekend, isTodaySkipped, this.config.scheduler.gracePeriodMinutes)
      }
    ];

    return actions.map((action) => ({
      ...action,
      statusText: getStatusText(action.status)
    }));
  }

  private skippedDateDetails(): SchedulerSkippedDateDetail[] {
    return [...this.config.scheduler.skippedDates]
      .sort()
      .map((date) => {
        const metadata = this.config.scheduler.skipMetadataByDate[date];
        return {
          date,
          source: metadata?.source ?? "unknown-legacy",
          scope: metadata?.scope ?? "whole-day",
          actionKey: metadata?.actionKey ?? null,
          remoteSource: metadata?.remoteSource ?? null,
          lastSeenRemoteAt: metadata?.lastSeenRemoteAt ?? null
        };
      });
  }

  private skipDate(dateKey: string, source: "local" | "remote-managed" = "local"): boolean {
    if (!isDateKey(dateKey)) {
      this.logger.warn(`Skip requested for invalid date key.`);
      return false;
    }

    if (this.config.scheduler.skippedDates.includes(dateKey)) {
      this.logger.info(`Skip requested for ${dateKey}, but it was already skipped.`);
      return false;
    }

    const now = new Date().toISOString();
    this.config.scheduler.skippedDates.push(dateKey);
    this.config.scheduler.skippedDates.sort();
    this.config.scheduler.skipMetadataByDate[dateKey] = {
      source,
      scope: "whole-day",
      actionKey: null,
      remoteSource: source === "remote-managed" ? "manual-import" : null,
      lastSeenRemoteAt: source === "remote-managed" ? now : null,
      updatedAt: now
    };
    this.configStore.save(this.config);
    this.logger.info(`Skipped action schedule for ${dateKey}.`);
    return true;
  }

  private unskipDate(dateKey: string): boolean {
    if (!isDateKey(dateKey)) {
      this.logger.warn(`Unskip requested for invalid date key.`);
      return false;
    }

    const nextSkippedDates = this.config.scheduler.skippedDates.filter((skippedDate) => skippedDate !== dateKey);

    if (nextSkippedDates.length === this.config.scheduler.skippedDates.length) {
      this.logger.info(`Unskip requested for ${dateKey}, but it was not skipped.`);
      return false;
    }

    this.config.scheduler.skippedDates = nextSkippedDates;
    delete this.config.scheduler.skipMetadataByDate[dateKey];
    this.configStore.save(this.config);
    this.logger.info(`Unskipped action schedule for ${dateKey}.`);
    return true;
  }

  private logStatusTransitions(dateKey: string, actions: ScheduleActionSnapshot[]): void {
    for (const action of actions) {
      const key = `${dateKey}:${action.action}`;
      const previous = this.lastStatuses.get(key);

      if (previous && previous !== action.status) {
        this.lastStatuses.set(key, action.status);
        this.logger.info(`${action.label} status changed from ${getStatusText(previous)} to ${action.statusText}.`);
        continue;
      }

      this.lastStatuses.set(key, action.status);
    }
  }
}

function getActionStatus(
  dateKey: string,
  time: string,
  now: Date,
  isWeekend: boolean,
  isSkipped: boolean,
  gracePeriodMinutes: number
): ScheduleActionStatus {
  if (isWeekend) {
    return "weekend";
  }

  if (isSkipped) {
    return "skipped";
  }

  const scheduledAt = dateTimeFromKey(dateKey, time);
  const elapsedMs = now.getTime() - scheduledAt.getTime();
  const graceMs = gracePeriodMinutes * 60 * 1000;

  if (elapsedMs < 0) {
    return "upcoming";
  }

  if (elapsedMs <= DUE_NOW_WINDOW_MS) {
    return "due-now";
  }

  if (elapsedMs <= graceMs) {
    return "within-grace-period";
  }

  return "missed";
}

function buildSummary(isWeekend: boolean, isSkipped: boolean, actions: ScheduleActionSnapshot[]): string {
  if (isWeekend) {
    return "Weekend / non-working day. No configured action is due.";
  }

  if (isSkipped) {
    return "Today is skipped. No configured action is due.";
  }

  const activeAction = actions.find((action) => action.status === "due-now" || action.status === "within-grace-period");
  if (activeAction) {
    return `${activeAction.label} is ${activeAction.statusText.toLowerCase()}. Manual confirmation only.`;
  }

  const missedAction = actions.find((action) => action.status === "missed");
  if (missedAction) {
    return `${missedAction.label} is missed. No automatic action will be taken.`;
  }

  return "Next action reminder is upcoming. Manual confirmation only.";
}

function randomTimeInWindow(dateKey: string, window: TimeWindow): string {
  const start = minutesFromTime(window.start);
  const end = minutesFromTime(window.end);
  const selectedMinutes = start + Math.floor(Math.random() * (end - start + 1));
  const selected = dateTimeFromKey(dateKey, timeFromMinutes(selectedMinutes));

  return formatTime(selected);
}

function getStatusText(status: ScheduleActionStatus): string {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "due-now":
      return "Due now";
    case "within-grace-period":
      return "Within grace period";
    case "missed":
      return "Missed";
    case "skipped":
      return "Skipped";
    case "weekend":
      return "Weekend";
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

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekendDate(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
