import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

interface DeviceStatusPayload {
  deviceId: string;
  deviceLabel: string;
  appVersion: string;
  appStatus: string;
  workerState: string;
  executionMode: string;
  networkStatus: string;
  captivePortalStatus: string;
  configuredSiteStatus: string;
  browserState: string;
  syncHealth: string;
  nextActionStatus: string | null;
  nextScheduleSummary: string | null;
  completionSummary: string | null;
  lastErrorText: string | null;
  recordedAt: string;
}

interface EventLogPayload {
  deviceId: string;
  eventTime: string;
  eventType: string;
  severity: string;
  actionKey: string | null;
  scheduleDate: string | null;
  message: string;
  details: Record<string, string | number | boolean | null>;
}

interface AcceptedPayload {
  deviceStatus: DeviceStatusPayload;
  events: EventLogPayload[];
}

const FORBIDDEN_KEY_NAMES = new Set([
  "credential",
  "credentials",
  "password",
  "cookie",
  "cookies",
  "html",
  "rawhtml",
  "raw_html",
  "screenshot",
  "url",
  "urls",
  "fullurl",
  "full_url",
  "token",
  "tokens",
  "selector",
  "selectors",
  "script",
  "scripts",
  "form",
  "forms",
  "magic",
  "4tredir",
  "link"
]);

const EVENT_TYPES = new Set([
  "startup",
  "shutdown",
  "desktop-status",
  "network-status",
  "configured-site-status",
  "captive-portal-status",
  "schedule",
  "skip",
  "command",
  "dry-run",
  "configured-action",
  "sync",
  "error"
]);

const SEVERITIES = new Set(["debug", "info", "warn", "error"]);
const ACTION_KEYS = new Set(["clock-in", "clock-out"]);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "method-not-allowed" }, 405);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!authHeader.toLowerCase().startsWith("bearer ") || !bearerToken) {
    return jsonResponse({ success: false, error: "missing-authorization" }, 401);
  }

  if (looksLikeServiceRoleKey(bearerToken)) {
    return jsonResponse({ success: false, error: "service-role-client-key-rejected" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "server-not-configured" }, 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "invalid-json" }, 400);
  }

  const validation = validateRequestBody(body);
  if (!validation.ok) {
    return jsonResponse({ success: false, error: validation.error }, 400);
  }

  const acceptedAt = new Date().toISOString();
  const payload = validation.payload;
  const deviceId = payload.deviceStatus.deviceId;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("device_id")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (deviceError) {
    return jsonResponse({ success: false, error: "device-check-failed" }, 500);
  }

  if (!device) {
    return jsonResponse({ success: false, error: "device-not-registered" }, 404);
  }

  const deviceUpdate = await supabase
    .from("devices")
    .update({
      display_name: payload.deviceStatus.deviceLabel,
      app_version: payload.deviceStatus.appVersion,
      last_seen_at: payload.deviceStatus.recordedAt,
      updated_at: acceptedAt
    })
    .eq("device_id", deviceId);

  if (deviceUpdate.error) {
    return jsonResponse({ success: false, error: "device-update-failed" }, 500);
  }

  const heartbeat = await supabase
    .from("heartbeats")
    .upsert({
      device_id: deviceId,
      app_status: payload.deviceStatus.appStatus,
      network_status: buildNetworkStatus(payload.deviceStatus),
      perakam_page_status: payload.deviceStatus.configuredSiteStatus,
      telegram_status: "paused",
      last_seen_at: payload.deviceStatus.recordedAt,
      status_text: buildStatusText(payload.deviceStatus),
      last_error_text: payload.deviceStatus.lastErrorText,
      updated_at: acceptedAt
    }, { onConflict: "device_id" });

  if (heartbeat.error) {
    return jsonResponse({ success: false, error: "heartbeat-write-failed" }, 500);
  }

  let eventsAccepted = 0;
  if (payload.events.length > 0) {
    const eventRows = payload.events.map((event) => ({
      device_id: deviceId,
      event_time: event.eventTime,
      event_type: event.eventType,
      severity: event.severity,
      action_key: event.actionKey,
      schedule_date: event.scheduleDate,
      message: event.message,
      details: event.details
    }));

    const eventInsert = await supabase.from("event_logs").insert(eventRows);
    if (eventInsert.error) {
      return jsonResponse({ success: false, error: "event-log-write-failed" }, 500);
    }

    eventsAccepted = eventRows.length;
  }

  return jsonResponse({
    success: true,
    acceptedAt,
    heartbeatAccepted: true,
    eventsAccepted
  }, 202);
});

function validateRequestBody(value: unknown): { ok: true; payload: AcceptedPayload } | { ok: false; error: string } {
  if (!isPlainObject(value)) {
    return { ok: false, error: "invalid-body" };
  }

  if (containsForbiddenKeyOrValue(value)) {
    return { ok: false, error: "forbidden-content" };
  }

  const body = value as JsonObject;
  const topLevelDeviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
  const deviceStatusValue = body.deviceStatus;
  if (!isPlainObject(deviceStatusValue)) {
    return { ok: false, error: "missing-device-status" };
  }

  const deviceStatus = validateDeviceStatus(deviceStatusValue as JsonObject);
  if (!deviceStatus) {
    return { ok: false, error: "invalid-device-status" };
  }

  if (topLevelDeviceId && topLevelDeviceId !== deviceStatus.deviceId) {
    return { ok: false, error: "device-id-mismatch" };
  }

  const eventsValue = Array.isArray(body.events) ? body.events : [];
  if (eventsValue.length > 20) {
    return { ok: false, error: "too-many-events" };
  }

  const events: EventLogPayload[] = [];
  for (const eventValue of eventsValue) {
    if (!isPlainObject(eventValue)) {
      return { ok: false, error: "invalid-event" };
    }

    const event = validateEventLog(eventValue as JsonObject, deviceStatus.deviceId);
    if (!event) {
      return { ok: false, error: "invalid-event" };
    }

    events.push(event);
  }

  return { ok: true, payload: { deviceStatus, events } };
}

function validateDeviceStatus(value: JsonObject): DeviceStatusPayload | null {
  const deviceId = readUuid(value.deviceId);
  const recordedAt = readIsoDate(value.recordedAt);

  if (!deviceId || !recordedAt) {
    return null;
  }

  return {
    deviceId,
    deviceLabel: readText(value.deviceLabel, 120) ?? "A.L.I.L.O.S. desktop",
    appVersion: readText(value.appVersion, 80) ?? "unknown",
    appStatus: readText(value.appStatus, 80) ?? "unknown",
    workerState: readText(value.workerState, 80) ?? "unknown",
    executionMode: readText(value.executionMode, 80) ?? "unknown",
    networkStatus: readText(value.networkStatus, 120) ?? "unknown",
    captivePortalStatus: readText(value.captivePortalStatus, 80) ?? "unknown",
    configuredSiteStatus: readText(value.configuredSiteStatus, 120) ?? "unknown",
    browserState: readText(value.browserState, 80) ?? "unknown",
    syncHealth: readText(value.syncHealth, 80) ?? "unknown",
    nextActionStatus: readNullableText(value.nextActionStatus, 80),
    nextScheduleSummary: readNullableText(value.nextScheduleSummary, 240),
    completionSummary: readNullableText(value.completionSummary, 240),
    lastErrorText: readNullableText(value.lastErrorText, 500),
    recordedAt
  };
}

function validateEventLog(value: JsonObject, expectedDeviceId: string): EventLogPayload | null {
  const deviceId = readUuid(value.deviceId);
  const eventTime = readIsoDate(value.eventTime);
  const eventType = readText(value.eventType, 80);
  const severity = readText(value.severity, 20);
  const message = readText(value.message, 500);

  if (!deviceId || deviceId !== expectedDeviceId || !eventTime || !eventType || !EVENT_TYPES.has(eventType) || !severity || !SEVERITIES.has(severity) || !message) {
    return null;
  }

  const actionKey = readNullableText(value.actionKey, 40);
  if (actionKey && !ACTION_KEYS.has(actionKey)) {
    return null;
  }

  const scheduleDate = readNullableDate(value.scheduleDate);
  const details = readDetails(value.details);
  if (!details) {
    return null;
  }

  return {
    deviceId,
    eventTime,
    eventType,
    severity,
    actionKey,
    scheduleDate,
    message,
    details
  };
}

function readDetails(value: unknown): Record<string, string | number | boolean | null> | null {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isPlainObject(value)) {
    return null;
  }

  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, 20)) {
    const normalizedKey = key.trim().slice(0, 80);
    if (!normalizedKey || isForbiddenKey(normalizedKey)) {
      return null;
    }

    if (typeof rawValue === "string") {
      const text = readText(rawValue, 160);
      if (text === null) {
        return null;
      }
      result[normalizedKey] = text;
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      result[normalizedKey] = rawValue;
    } else if (typeof rawValue === "boolean" || rawValue === null) {
      result[normalizedKey] = rawValue;
    } else {
      return null;
    }
  }

  return result;
}

function containsForbiddenKeyOrValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenKeyOrValue(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).some(([key, nestedValue]) => isForbiddenKey(key) || containsForbiddenKeyOrValue(nestedValue));
  }

  return typeof value === "string" && looksLikeForbiddenContent(value);
}

function looksLikeForbiddenContent(value: string): boolean {
  const text = value.trim();
  return /https?:\/\/[^\s?#]+[^\s]*[?#][^\s]*/i.test(text)
    || /\blink=/i.test(text)
    || /\bmagic=/i.test(text)
    || /\b4Tredir=/i.test(text)
    || /\bBearer\s+[A-Za-z0-9._-]+/i.test(text)
    || /\bbot\d+:[A-Za-z0-9_-]{15,}\b/i.test(text)
    || looksLikeServiceRoleKey(text);
}

function looksLikeServiceRoleKey(value: string): boolean {
  const text = value.replace(/^Bearer\s+/i, "").trim();
  if (!text) {
    return false;
  }

  if (text.startsWith("sb_secret_")) {
    return true;
  }

  const parts = text.split(".");
  if (parts.length < 2) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, "=");
  return atob(padded);
}

function isForbiddenKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return FORBIDDEN_KEY_NAMES.has(normalized);
}

function readUuid(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function readIsoDate(value: unknown): string | null {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readNullableDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function readNullableText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return readText(value, maxLength);
}

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (looksLikeForbiddenContent(value)) {
    return null;
  }

  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function buildNetworkStatus(status: DeviceStatusPayload): string {
  return `${status.networkStatus}; captivePortal=${status.captivePortalStatus}`.slice(0, 120);
}

function buildStatusText(status: DeviceStatusPayload): string {
  return [
    `worker=${status.workerState}`,
    `mode=${status.executionMode}`,
    `browser=${status.browserState}`,
    `sync=${status.syncHealth}`,
    status.nextActionStatus ? `next=${status.nextActionStatus}` : null,
    status.nextScheduleSummary,
    status.completionSummary
  ].filter(Boolean).join("; ").slice(0, 500);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(body: JsonObject, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
