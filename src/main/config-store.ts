import fs from "node:fs";
import path from "node:path";
import type { AppConfig, AttendanceCompletionRecord } from "../shared/types";

const defaultConfig: AppConfig = {
  worker: {
    enabled: true,
    pollIntervalSeconds: 60
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

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "config.json");
  }

  get path(): string {
    return this.filePath;
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

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
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
