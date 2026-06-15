import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../shared/types";

const defaultConfig: AppConfig = {
  worker: {
    enabled: true,
    pollIntervalSeconds: 60
  },
  attendance: {
    clockInPlaceholder: "08:00",
    clockOutPlaceholder: "17:00"
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

    return {
      worker: {
        ...defaultConfig.worker,
        ...parsed.worker
      },
      attendance: {
        ...defaultConfig.attendance,
        ...parsed.attendance
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
      }
    };
  }

  save(config: AppConfig): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
}
