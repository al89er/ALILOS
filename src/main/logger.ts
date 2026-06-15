import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type { AppLogEntry } from "../shared/types";

export class AppLogger extends EventEmitter {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    super();
    this.filePath = path.join(userDataPath, "logs", "alilos.log");
  }

  get path(): string {
    return this.filePath;
  }

  info(message: string): void {
    this.write("info", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  error(message: string): void {
    this.write("error", message);
  }

  async recent(limit = 20): Promise<AppLogEntry[]> {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const lines: string[] = [];
    const stream = fs.createReadStream(this.filePath, { encoding: "utf8" });
    const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of reader) {
      if (line.trim().length === 0) {
        continue;
      }

      lines.push(line);
      if (lines.length > limit) {
        lines.shift();
      }
    }

    return lines.flatMap((line) => {
      try {
        return [JSON.parse(line) as AppLogEntry];
      } catch {
        return [];
      }
    });
  }

  private write(level: AppLogEntry["level"], message: string): void {
    const entry: AppLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, "utf8");
    this.emit("entry", entry);
  }
}
