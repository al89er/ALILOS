import type {
  ScheduleActionSnapshot,
  ScheduleSnapshot,
  TelegramPollingSnapshot,
  TelegramSettings,
  TelegramTestResult
} from "../shared/types";
import type { AppLogger } from "./logger";

const TEST_MESSAGE = "A.L.I.L.O.S. test notification from desktop app";
const POLL_INTERVAL_MS = 10000;

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: {
      id?: number | string;
    };
  };
}

export interface TelegramCommandHandlers {
  getScheduleSnapshot: () => ScheduleSnapshot;
  skipToday: () => void;
  unskipToday: () => void;
  skipTomorrow: () => void;
  unskipTomorrow: () => void;
  setLastUpdateId: (lastUpdateId: number) => void;
  persistSettings: () => void;
  broadcastSnapshot: () => void;
}

export class TelegramService {
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastCheckedAt: string | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly logger: AppLogger,
    private readonly getSettings: () => TelegramSettings,
    private readonly handlers: TelegramCommandHandlers
  ) {}

  configure(): void {
    const settings = this.getSettings();

    if (!isConfigured(settings)) {
      this.stopPolling();
      return;
    }

    this.startPolling();
  }

  isConfigured(): boolean {
    return isConfigured(this.getSettings());
  }

  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.isPolling = false;
  }

  snapshot(): TelegramPollingSnapshot {
    const settings = this.getSettings();

    return {
      enabled: settings.enabled,
      running: this.isPolling,
      lastCheckedAt: this.lastCheckedAt,
      lastError: this.lastError
    };
  }

  async sendTestNotification(settings: TelegramSettings): Promise<TelegramTestResult> {
    const testedAt = new Date().toISOString();
    const validationError = validateSettings(settings);

    if (validationError) {
      this.logger.warn(`Telegram test notification not sent: ${validationError}`);
      return {
        ok: false,
        message: validationError,
        testedAt
      };
    }

    const result = await this.sendMessage(TEST_MESSAGE);

    if (result.ok) {
      this.logger.info("Telegram test notification sent to configured chat.");
      return {
        ok: true,
        message: "Telegram test notification sent.",
        testedAt
      };
    }

    this.logger.warn(`Telegram test notification failed for configured chat: ${result.message}`);
    return {
      ok: false,
      message: result.message,
      testedAt
    };
  }

  async sendNotification(text: string): Promise<{ ok: true } | { ok: false; message: string }> {
    return this.sendMessage(text);
  }

  private startPolling(): void {
    if (this.timer) {
      return;
    }

    this.isPolling = true;
    this.lastError = null;
    this.logger.info("Telegram polling started.");
    this.timer = setInterval(() => {
      void this.pollOnce();
    }, POLL_INTERVAL_MS);
    void this.pollOnce();
  }

  private async pollOnce(): Promise<void> {
    const settings = this.getSettings();

    if (!isConfigured(settings)) {
      this.stopPolling();
      return;
    }

    try {
      this.lastCheckedAt = new Date().toISOString();
      const updates = await this.getUpdates(settings);
      let lastUpdateId = settings.lastUpdateId;

      for (const update of updates) {
        await this.processUpdate(update);
        if (update.update_id > lastUpdateId) {
          lastUpdateId = update.update_id;
        }
      }

      if (updates.length > 0) {
        this.handlers.setLastUpdateId(lastUpdateId);
        this.handlers.persistSettings();
      }

      this.lastError = null;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Unknown Telegram polling error.";
      this.lastError = sanitizeMessage(rawMessage, settings);
      this.logger.warn(`Telegram polling failed: ${this.lastError}`);
    } finally {
      this.handlers.broadcastSnapshot();
    }
  }

  private async getUpdates(settings: TelegramSettings): Promise<TelegramUpdate[]> {
    const url = new URL(`https://api.telegram.org/bot${encodeURIComponent(settings.botToken)}/getUpdates`);
    url.searchParams.set("offset", String(settings.lastUpdateId + 1));
    url.searchParams.set("timeout", "0");
    url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

    const payload = await this.callTelegramApi<TelegramUpdate[]>(url.toString());
    return payload.result ?? [];
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    const settings = this.getSettings();
    const chatId = String(update.message?.chat?.id ?? "");

    if (chatId !== settings.chatId) {
      this.logger.warn("Ignored Telegram update from unauthorized chat.");
      return;
    }

    const command = normalizeCommand(update.message?.text ?? "", settings.commandPrefix);

    if (!command) {
      return;
    }

    this.logger.info(`Handling Telegram command ${command} from configured chat.`);

    switch (command) {
      case "/start":
      case "/help":
        await this.reply(buildHelpMessage(settings.commandPrefix));
        return;
      case "/status":
        await this.reply(buildStatusMessage(this.handlers.getScheduleSnapshot()));
        return;
      case "/skip":
        this.handlers.skipToday();
        await this.reply("Today has been skipped.");
        this.handlers.broadcastSnapshot();
        return;
      case "/unskip":
        this.handlers.unskipToday();
        await this.reply("Today has been unskipped.");
        this.handlers.broadcastSnapshot();
        return;
      case "/skipnext":
        this.handlers.skipTomorrow();
        await this.reply("Tomorrow has been skipped.");
        this.handlers.broadcastSnapshot();
        return;
      case "/unskipnext":
        this.handlers.unskipTomorrow();
        await this.reply("Tomorrow has been unskipped.");
        this.handlers.broadcastSnapshot();
        return;
      case "/skips":
        await this.reply(buildSkippedDatesMessage(this.handlers.getScheduleSnapshot().skippedDates));
        return;
      default:
        await this.reply(`Unsupported command. Send ${commandPrefixLabel(settings.commandPrefix)}_help for allowed commands.`);
    }
  }

  private async reply(text: string): Promise<void> {
    const result = await this.sendMessage(text);

    if (!result.ok) {
      this.logger.warn(`Telegram command reply failed: ${result.message}`);
    }
  }

  private async sendMessage(text: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const settings = this.getSettings();
    const validationError = validateSettings(settings);

    if (validationError) {
      return {
        ok: false,
        message: validationError
      };
    }

    try {
      const payload = await this.callTelegramApi<unknown>(`https://api.telegram.org/bot${encodeURIComponent(settings.botToken)}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text
        })
      });

      if (!payload.ok) {
        return {
          ok: false,
          message: sanitizeMessage(payload.description || "Telegram API rejected the message.", settings)
        };
      }

      return { ok: true };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Unknown Telegram network error.";
      return {
        ok: false,
        message: sanitizeMessage(rawMessage, settings)
      };
    }
  }

  private async callTelegramApi<T>(url: string, init?: RequestInit): Promise<TelegramApiResponse<T>> {
    const settings = this.getSettings();
    const response = await fetch(url, init);
    const payload = await response.json() as TelegramApiResponse<T>;

    if (!response.ok || !payload.ok) {
      throw new Error(sanitizeMessage(payload.description || `Telegram API returned HTTP ${response.status}.`, settings));
    }

    return payload;
  }
}

function buildHelpMessage(commandPrefix: string): string {
  const prefix = commandPrefixLabel(commandPrefix);

  return [
    "A.L.I.L.O.S. commands:",
    `${prefix}_status - show today's schedule status`,
    `${prefix}_skip - skip today`,
    `${prefix}_unskip - unskip today`,
    `${prefix}_skipnext - skip tomorrow`,
    `${prefix}_unskipnext - unskip tomorrow`,
    `${prefix}_skips - list skipped dates`,
    `${prefix}_help - show this list`
  ].join("\n");
}

function buildStatusMessage(snapshot: ScheduleSnapshot): string {
  const nextAction = getNextRelevantAction(snapshot.actions);

  return [
    `Date: ${snapshot.today}`,
    `Morning action: ${snapshot.schedule.clockInTime}`,
    `Evening action: ${snapshot.schedule.clockOutTime}`,
    `Weekend/non-working: ${snapshot.isWeekend ? "yes" : "no"}`,
    `Skipped: ${snapshot.isTodaySkipped ? "yes" : "no"}`,
    `Status: ${snapshot.summary}`,
    `Next relevant action: ${nextAction}`
  ].join("\n");
}

function getNextRelevantAction(actions: ScheduleActionSnapshot[]): string {
  const action = actions.find((item) => item.status === "due-now" || item.status === "within-grace-period")
    ?? actions.find((item) => item.status === "upcoming");

  if (!action) {
    return "none";
  }

  return `${action.label} at ${action.time} (${action.statusText})`;
}

function buildSkippedDatesMessage(skippedDates: string[]): string {
  if (skippedDates.length === 0) {
    return "There are no skipped dates.";
  }

  return `Skipped dates:\n${skippedDates.join("\n")}`;
}

function normalizeCommand(text: string, configuredPrefix: string): string | null {
  const command = text.trim().split(/\s+/)[0]?.toLowerCase();

  if (!command) {
    return null;
  }

  const prefix = commandPrefixLabel(configuredPrefix);
  const commandMap = new Map<string, string>([
    [`${prefix}_start`, "/start"],
    [`${prefix}_help`, "/help"],
    [`${prefix}_status`, "/status"],
    [`${prefix}_skip`, "/skip"],
    [`${prefix}_unskip`, "/unskip"],
    [`${prefix}_skipnext`, "/skipnext"],
    [`${prefix}_unskipnext`, "/unskipnext"],
    [`${prefix}_skips`, "/skips"]
  ]);

  return commandMap.get(command) ?? null;
}

function commandPrefixLabel(prefix: string | undefined): string {
  const normalized = String(prefix ?? "").trim().replace(/^\/+/, "").toLowerCase() || "alilos";
  return `/${normalized}`;
}

function validateSettings(settings: TelegramSettings): string | null {
  if (!settings.enabled) {
    return "Telegram is disabled.";
  }

  if (!settings.botToken.trim()) {
    return "Telegram bot token is required.";
  }

  if (!settings.chatId.trim()) {
    return "Telegram chat ID is required.";
  }

  return null;
}

function isConfigured(settings: TelegramSettings): boolean {
  return !validateSettings(settings);
}

function sanitizeMessage(message: string, settings: TelegramSettings): string {
  const trimmedToken = settings.botToken.trim();
  const trimmedChatId = settings.chatId.trim();
  let sanitized = message;

  if (trimmedToken) {
    sanitized = sanitized.split(trimmedToken).join("[redacted-token]");
  }

  if (trimmedChatId) {
    sanitized = sanitized.split(trimmedChatId).join("[redacted-chat-id]");
  }

  return sanitized;
}
