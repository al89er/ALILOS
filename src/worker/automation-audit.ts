import { randomUUID } from "node:crypto";
import type { ConfigStore } from "../main/config-store";
import type { AppLogger } from "../main/logger";
import type {
  AppConfig,
  AttendanceActionType,
  AutomationAuditEvent,
  AutomationAuditEventType
} from "../shared/types";

const MAX_AUDIT_EVENTS = 200;

export function appendAutomationAuditEvent(
  config: AppConfig,
  configStore: ConfigStore,
  logger: AppLogger,
  input: {
    type: AutomationAuditEventType;
    action?: AttendanceActionType | null;
    dateKey?: string | null;
    status?: AutomationAuditEvent["status"];
    message: string;
    details?: AutomationAuditEvent["details"];
  }
): AutomationAuditEvent {
  const event: AutomationAuditEvent = {
    id: randomUUID(),
    type: input.type,
    action: input.action ?? null,
    dateKey: input.dateKey ?? null,
    status: input.status ?? "info",
    message: sanitizeText(input.message, 240),
    createdAt: new Date().toISOString(),
    details: sanitizeDetails(input.details ?? {})
  };

  config.automation.auditEvents = [...config.automation.auditEvents, event].slice(-MAX_AUDIT_EVENTS);
  configStore.save(config);
  logger.info(`Automation audit: ${event.type}${event.action ? ` ${event.action}` : ""}${event.dateKey ? ` ${event.dateKey}` : ""}. ${event.message}`);
  return event;
}

export function hasAutomationAuditEvent(
  config: AppConfig,
  input: {
    type: AutomationAuditEventType;
    action: AttendanceActionType;
    dateKey: string;
  }
): boolean {
  return config.automation.auditEvents.some((event) => (
    event.type === input.type
    && event.action === input.action
    && event.dateKey === input.dateKey
  ));
}

function sanitizeDetails(details: AutomationAuditEvent["details"]): AutomationAuditEvent["details"] {
  const sanitized: AutomationAuditEvent["details"] = {};

  for (const [key, value] of Object.entries(details).slice(0, 20)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeText(value, 160);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function sanitizeText(value: string, limit: number): string {
  return value
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

