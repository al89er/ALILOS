import type {
  AppConfig,
  DailySchedule,
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

  private skipDate(dateKey: string): void {
    if (this.config.scheduler.skippedDates.includes(dateKey)) {
      this.logger.info(`Skip requested for ${dateKey}, but it was already skipped.`);
      return;
    }

    this.config.scheduler.skippedDates.push(dateKey);
    this.config.scheduler.skippedDates.sort();
    this.configStore.save(this.config);
    this.logger.info(`Skipped action schedule for ${dateKey}.`);
  }

  private unskipDate(dateKey: string): void {
    const nextSkippedDates = this.config.scheduler.skippedDates.filter((skippedDate) => skippedDate !== dateKey);

    if (nextSkippedDates.length === this.config.scheduler.skippedDates.length) {
      this.logger.info(`Unskip requested for ${dateKey}, but it was not skipped.`);
      return;
    }

    this.config.scheduler.skippedDates = nextSkippedDates;
    this.configStore.save(this.config);
    this.logger.info(`Unskipped action schedule for ${dateKey}.`);
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

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekendDate(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
