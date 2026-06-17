import fs from "node:fs";
import path from "node:path";
import type { AppConfig, AttendanceCompletionRecord, AutomationAuditEvent, ExecutionMode } from "../shared/types";

export interface EnvLocalTelegramSecrets {
  botToken: string;
  chatId: string;
}

const defaultConfig: AppConfig = {
  worker: {
    enabled: true,
    pollIntervalSeconds: 60
  },
  automation: {
    executionMode: "manual-confirm",
    monitorIntervalSeconds: 30,
    prepareBrowserInDryRun: true,
    auditEvents: []
  },
  heartbeat: {
    enabled: false,
    endpointUrl: "",
    intervalSeconds: 60
  },
  attendance: {
    clockInPlaceholder: "08:00",
    clockOutPlaceholder: "17:00",
    completionsByDate: {}
  },
  scheduler: {
    clockInWindow: {
      start: "07:45",
      end: "07:50"
    },
    clockOutWindow: {
      start: "17:05",
      end: "17:10"
    },
    gracePeriodMinutes: 5,
    reminders: {
      enabled: true,
      approachingMinutes: 5,
      systemNotificationsEnabled: true
    },
    schedulesByDate: {},
    skippedDates: [],
    notificationsByDate: {}
  },
  telegram: {
    enabled: false,
    botToken: "",
    chatId: "",
    commandPrefix: "alilos",
    lastUpdateId: 0
  },
  institutionCredential: {
    enabled: true,
    username: "",
    encryptedPassword: "",
    lastUpdatedAt: null
  },
  perakam: {
    dashboardUrl: "https://perakamwaktu3.upm.edu.my/",
    autoLogin: {
      enabled: false,
      useSharedCredential: true,
      username: "",
      encryptedPassword: "",
      lastUpdatedAt: null,
      lastLoginAttemptAt: null,
      lastLoginResult: "unknown",
      lastLoginReason: null
    }
  },
  networkMonitor: {
    enabled: true,
    intervalSeconds: 60,
    notifyOnInternetDown: true,
    notifyOnPerakamDown: true,
    notifyOnRecovery: true,
    failureThreshold: 2,
    captivePortalDetectionEnabled: true,
    openDetectedPortalIn: "external",
    retainPortalEvidenceMinutes: 120
  }
};

export class ConfigStore {
  private readonly filePath: string;
  private readonly envLocalPath: string;
  private readonly envLocalTelegramSecrets: EnvLocalTelegramSecrets;

  constructor(userDataPath: string, appRootPath = process.cwd()) {
    this.filePath = path.join(userDataPath, "config.json");
    this.envLocalPath = path.join(appRootPath, ".env.local");
    this.envLocalTelegramSecrets = readEnvLocalTelegramSecrets(this.envLocalPath);
  }

  get path(): string {
    return this.filePath;
  }

  get telegramEnvLocal(): EnvLocalTelegramSecrets {
    return this.envLocalTelegramSecrets;
  }

  load(): AppConfig {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      this.save(defaultConfig);
      return defaultConfig;
    }

    const raw = fs.readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const legacyPerakamCredential = parsed.perakam?.autoLogin;
    const institutionCredential = {
      ...defaultConfig.institutionCredential,
      ...parsed.institutionCredential
    };

    if (!institutionCredential.username && legacyPerakamCredential?.username) {
      institutionCredential.username = legacyPerakamCredential.username;
    }

    if (!institutionCredential.encryptedPassword && legacyPerakamCredential?.encryptedPassword) {
      institutionCredential.encryptedPassword = legacyPerakamCredential.encryptedPassword;
    }

    if (!institutionCredential.lastUpdatedAt && legacyPerakamCredential?.lastUpdatedAt) {
      institutionCredential.lastUpdatedAt = legacyPerakamCredential.lastUpdatedAt;
    }

    return {
      worker: {
        ...defaultConfig.worker,
        ...parsed.worker
      },
      automation: {
        ...defaultConfig.automation,
        ...parsed.automation,
        executionMode: normalizeExecutionMode(parsed.automation?.executionMode),
        monitorIntervalSeconds: clampNumber(parsed.automation?.monitorIntervalSeconds, 15, 24 * 60 * 60, defaultConfig.automation.monitorIntervalSeconds),
        prepareBrowserInDryRun: parsed.automation?.prepareBrowserInDryRun !== false,
        auditEvents: normalizeAuditEvents(parsed.automation?.auditEvents)
      },
      heartbeat: {
        ...defaultConfig.heartbeat,
        ...parsed.heartbeat,
        enabled: Boolean(parsed.heartbeat?.enabled),
        endpointUrl: sanitizeUrlText(parsed.heartbeat?.endpointUrl),
        intervalSeconds: clampNumber(parsed.heartbeat?.intervalSeconds, 30, 24 * 60 * 60, defaultConfig.heartbeat.intervalSeconds)
      },
      attendance: {
        ...defaultConfig.attendance,
        ...parsed.attendance,
        completionsByDate: normalizeCompletionsByDate(parsed.attendance?.completionsByDate)
      },
      scheduler: {
        ...defaultConfig.scheduler,
        ...parsed.scheduler,
        clockInWindow: {
          ...defaultConfig.scheduler.clockInWindow,
          ...parsed.scheduler?.clockInWindow
        },
        clockOutWindow: {
          ...defaultConfig.scheduler.clockOutWindow,
          ...parsed.scheduler?.clockOutWindow
        },
        schedulesByDate: {
          ...defaultConfig.scheduler.schedulesByDate,
          ...parsed.scheduler?.schedulesByDate
        },
        reminders: {
          ...defaultConfig.scheduler.reminders,
          ...parsed.scheduler?.reminders
        },
        skippedDates: parsed.scheduler?.skippedDates ?? defaultConfig.scheduler.skippedDates,
        notificationsByDate: {
          ...defaultConfig.scheduler.notificationsByDate,
          ...parsed.scheduler?.notificationsByDate
        }
      },
      telegram: {
        ...defaultConfig.telegram,
        ...parsed.telegram
      },
      institutionCredential,
      perakam: {
        ...defaultConfig.perakam,
        ...parsed.perakam,
        autoLogin: {
          ...defaultConfig.perakam.autoLogin,
          ...parsed.perakam?.autoLogin,
          useSharedCredential: parsed.perakam?.autoLogin?.useSharedCredential !== false
        }
      },
      networkMonitor: {
        ...defaultConfig.networkMonitor,
        ...parsed.networkMonitor,
        intervalSeconds: clampNumber(parsed.networkMonitor?.intervalSeconds, 30, 24 * 60 * 60, defaultConfig.networkMonitor.intervalSeconds),
        failureThreshold: clampNumber(parsed.networkMonitor?.failureThreshold, 1, 20, defaultConfig.networkMonitor.failureThreshold),
        captivePortalDetectionEnabled: parsed.networkMonitor?.captivePortalDetectionEnabled !== false,
        openDetectedPortalIn: parsed.networkMonitor?.openDetectedPortalIn === "playwright" ? "playwright" : "external",
        retainPortalEvidenceMinutes: clampNumber(parsed.networkMonitor?.retainPortalEvidenceMinutes, 5, 24 * 60, defaultConfig.networkMonitor.retainPortalEvidenceMinutes)
      }
    };
  }

  save(config: AppConfig): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
}

function readEnvLocalTelegramSecrets(filePath: string): EnvLocalTelegramSecrets {
  const values = readEnvLocalFile(filePath);

  return {
    botToken: sanitizeEnvSecret(values.TELEGRAM_BOT_TOKEN),
    chatId: sanitizeEnvSecret(values.TELEGRAM_CHAT_ID)
  };
}

function readEnvLocalFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values: Record<string, string> = {};
  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed) {
      values[parsed.key] = parsed.value;
    }
  }

  return values;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = stripEnvValueComment(trimmed.slice(separatorIndex + 1).trim());

  return { key, value: unwrapEnvValue(value) };
}

function stripEnvValueComment(value: string): string {
  if (value.startsWith("\"") || value.startsWith("'")) {
    return value;
  }

  const commentIndex = value.indexOf(" #");
  return commentIndex >= 0 ? value.slice(0, commentIndex).trim() : value;
}

function unwrapEnvValue(value: string): string {
  if (value.length >= 2 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }

  return value;
}

function sanitizeEnvSecret(value: unknown): string {
  return String(value ?? "").trim();
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function normalizeExecutionMode(value: unknown): ExecutionMode {
  if (value === "notify-only" || value === "manual-confirm" || value === "dry-run") {
    return value;
  }

  return defaultConfig.automation.executionMode;
}

function sanitizeUrlText(value: unknown): string {
  return String(value ?? "").trim().slice(0, 500);
}

function normalizeAuditEvents(value: AutomationAuditEvent[] | undefined): AutomationAuditEvent[] {
  return (Array.isArray(value) ? value : [])
    .filter((event): event is AutomationAuditEvent => Boolean(event?.id && event.type && event.createdAt && event.message))
    .slice(-200)
    .map((event) => ({
      id: String(event.id),
      type: event.type,
      action: event.action === "clock-in" || event.action === "clock-out" ? event.action : null,
      dateKey: typeof event.dateKey === "string" ? event.dateKey.slice(0, 20) : null,
      status: event.status === "passed" || event.status === "blocked" || event.status === "failed" ? event.status : "info",
      message: String(event.message).replace(/[?#][^\s]*/g, "?[redacted]").slice(0, 240),
      createdAt: String(event.createdAt),
      details: normalizeAuditDetails(event.details)
    }));
}

function normalizeAuditDetails(value: AutomationAuditEvent["details"] | undefined): AutomationAuditEvent["details"] {
  const normalized: AutomationAuditEvent["details"] = {};

  for (const [key, detail] of Object.entries(value ?? {}).slice(0, 20)) {
    if (typeof detail === "string") {
      normalized[key] = detail.replace(/[?#][^\s]*/g, "?[redacted]").slice(0, 160);
    } else if (typeof detail === "number" || typeof detail === "boolean" || detail === null) {
      normalized[key] = detail;
    }
  }

  return normalized;
}

function normalizeCompletionsByDate(
  value: Partial<Record<string, Partial<AttendanceCompletionRecord>[]>> | undefined
): Record<string, AttendanceCompletionRecord[]> {
  const normalized: Record<string, AttendanceCompletionRecord[]> = {};

  for (const [dateKey, records] of Object.entries(value ?? {})) {
    normalized[dateKey] = (records ?? [])
      .filter((record): record is Partial<AttendanceCompletionRecord> => Boolean(record?.dateKey && record.action && record.confirmationId && record.mappedTargetId))
      .map((record) => ({
        dateKey: record.dateKey ?? dateKey,
        action: record.action!,
        confirmationId: record.confirmationId!,
        mappedTargetId: record.mappedTargetId!,
        completedAt: record.completedAt ?? new Date().toISOString(),
        generatedScheduleTime: record.generatedScheduleTime ?? "",
        sanitizedUrlAfterClick: record.sanitizedUrlAfterClick ?? null,
        state: record.state ?? "click-succeeded-local",
        verification: record.verification ?? null,
        manuallyVerifiedAt: record.manuallyVerifiedAt ?? null
      }));
  }

  return normalized;
}
