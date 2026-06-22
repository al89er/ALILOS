import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

type JsonObject = Record<string, unknown>;

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return corsPreflightResponse();
  }

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

  const { deviceId, dateKey, monthKey } = validation.payload;
  const monthRange = monthBounds(monthKey);
  const requestedAt = new Date().toISOString();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("device_id, display_name, platform, app_version, last_seen_at, is_active, updated_at")
    .eq("device_id", deviceId)
    .maybeSingle();

  if (deviceError) {
    return jsonResponse({ success: false, error: "device-check-failed" }, 500);
  }

  if (!device) {
    return jsonResponse({ success: false, error: "device-not-registered" }, 404);
  }

  const [heartbeat, schedules, skips, completions, commands, eventLogs] = await Promise.all([
    supabase
      .from("heartbeats")
      .select("app_status, network_status, perakam_page_status, telegram_status, last_seen_at, status_text, last_error_text, updated_at")
      .eq("device_id", deviceId)
      .maybeSingle(),
    supabase
      .from("daily_schedules")
      .select("schedule_date, action_key, target_time_local, window_start_local, window_end_local, source, status, updated_at")
      .eq("device_id", deviceId)
      .eq("schedule_date", dateKey)
      .order("action_key", { ascending: true }),
    supabase
      .from("skip_dates")
      .select("skip_date, action_key, reason, source, updated_at")
      .eq("device_id", deviceId)
      .gte("skip_date", monthRange.start)
      .lt("skip_date", monthRange.end)
      .order("skip_date", { ascending: true })
      .order("action_key", { ascending: true }),
    supabase
      .from("completion_records")
      .select("action_date, action_key, state, verification_state, sanitized_reason, attempted_at, verified_at, updated_at")
      .eq("device_id", deviceId)
      .eq("action_date", dateKey)
      .order("action_key", { ascending: true }),
    supabase
      .from("command_requests")
      .select("id, command_type, status, requested_at, claimed_at, completed_at, result_summary, updated_at")
      .eq("device_id", deviceId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("event_logs")
      .select("event_time, event_type, severity, action_key, schedule_date, message, created_at")
      .eq("device_id", deviceId)
      .order("event_time", { ascending: false })
      .limit(30)
  ]);

  if (heartbeat.error) {
    return jsonResponse({ success: false, error: "heartbeat-read-failed" }, 500);
  }
  if (schedules.error) {
    return jsonResponse({ success: false, error: "schedule-read-failed" }, 500);
  }
  if (skips.error) {
    return jsonResponse({ success: false, error: "skip-read-failed" }, 500);
  }
  if (completions.error) {
    return jsonResponse({ success: false, error: "completion-read-failed" }, 500);
  }
  if (commands.error) {
    return jsonResponse({ success: false, error: "command-read-failed" }, 500);
  }
  if (eventLogs.error) {
    return jsonResponse({ success: false, error: "event-log-read-failed" }, 500);
  }

  return jsonResponse({
    success: true,
    requestedAt,
    dateKey,
    monthKey,
    device: {
      deviceId,
      label: readNullableText(device.display_name, 120) ?? "A.L.I.L.O.S. desktop",
      platform: readNullableText(device.platform, 40),
      appVersion: readNullableText(device.app_version, 80),
      isActive: device.is_active === true,
      lastSeenAt: readIsoDate(device.last_seen_at),
      updatedAt: readIsoDate(device.updated_at)
    },
    heartbeat: heartbeat.data ? {
      appStatus: readNullableText(heartbeat.data.app_status, 80) ?? "unknown",
      networkStatus: readNullableText(heartbeat.data.network_status, 120) ?? "unknown",
      configuredSiteStatus: readNullableText(heartbeat.data.perakam_page_status, 120) ?? "unknown",
      telegramStatus: readNullableText(heartbeat.data.telegram_status, 120) ?? "unknown",
      lastSeenAt: readIsoDate(heartbeat.data.last_seen_at),
      statusText: readNullableText(heartbeat.data.status_text, 500),
      lastErrorText: readNullableText(heartbeat.data.last_error_text, 500),
      updatedAt: readIsoDate(heartbeat.data.updated_at)
    } : null,
    schedules: (schedules.data ?? []).map((row) => ({
      scheduleDate: readDate(row.schedule_date) ?? dateKey,
      actionKey: readActionKey(row.action_key) ?? "clock-in",
      targetTimeLocal: readTime(row.target_time_local) ?? "--:--",
      windowStartLocal: readNullableTime(row.window_start_local),
      windowEndLocal: readNullableTime(row.window_end_local),
      source: readNullableText(row.source, 80) ?? "unknown",
      status: readNullableText(row.status, 80) ?? "unknown",
      updatedAt: readIsoDate(row.updated_at)
    })),
    skips: (skips.data ?? []).map((row) => ({
      skipDate: readDate(row.skip_date) ?? dateKey,
      actionKey: readNullableActionKey(row.action_key),
      reason: readNullableText(row.reason, 500),
      source: readNullableText(row.source, 80) ?? "unknown",
      updatedAt: readIsoDate(row.updated_at)
    })),
    completions: (completions.data ?? []).map((row) => ({
      actionDate: readDate(row.action_date) ?? dateKey,
      actionKey: readActionKey(row.action_key) ?? "clock-in",
      state: readNullableText(row.state, 80) ?? "unknown",
      verificationState: readNullableText(row.verification_state, 80),
      sanitizedReason: readNullableText(row.sanitized_reason, 500),
      attemptedAt: readIsoDate(row.attempted_at),
      verifiedAt: readIsoDate(row.verified_at),
      updatedAt: readIsoDate(row.updated_at)
    })),
    commandSync: summarizeCommands(commands.data ?? []),
    eventLogs: (eventLogs.data ?? []).map((row) => ({
      eventTime: readIsoDate(row.event_time),
      eventType: readNullableText(row.event_type, 80) ?? "event",
      severity: readSeverity(row.severity) ?? "info",
      actionKey: readNullableActionKey(row.action_key),
      scheduleDate: readDate(row.schedule_date),
      message: readNullableText(row.message, 500) ?? "Sanitized event.",
      createdAt: readIsoDate(row.created_at)
    })),
    safety: {
      readOnly: true,
      webAutomation: false,
      credentialsLocalOnly: true,
      remoteConfiguredActionImplemented: false,
      serviceRoleInClient: false
    }
  }, 200);
});

function summarizeCommands(rows: JsonObject[]): JsonObject {
  const counters = {
    pending: 0,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    expired: 0,
    rejected: 0,
    cancelled: 0
  };
  const latest = rows[0] ?? null;

  for (const row of rows) {
    const status = readCommandStatus(row.status);
    if (status) {
      counters[status] += 1;
    }
  }

  return {
    counters,
    latest: latest ? {
      commandId: shortId(readUuid(latest.id) ?? ""),
      commandType: readNullableText(latest.command_type, 80) ?? "unknown",
      status: readCommandStatus(latest.status) ?? "unknown",
      requestedAt: readIsoDate(latest.requested_at),
      claimedAt: readIsoDate(latest.claimed_at),
      completedAt: readIsoDate(latest.completed_at),
      resultSummary: readNullableText(latest.result_summary, 500),
      updatedAt: readIsoDate(latest.updated_at)
    } : null,
    controlsAvailable: false
  };
}

function validateRequestBody(value: unknown): { ok: true; payload: { deviceId: string; dateKey: string; monthKey: string } } | { ok: false; error: string } {
  if (!isPlainObject(value) || containsForbiddenKeyOrValue(value)) {
    return { ok: false, error: "invalid-body" };
  }

  const deviceId = readUuid(value.deviceId);
  const dateKey = readDate(value.dateKey) ?? todayDateKey();
  const monthKey = readMonthKey(value.monthKey) ?? dateKey.slice(0, 7);

  if (!deviceId) {
    return { ok: false, error: "invalid-device-id" };
  }

  return { ok: true, payload: { deviceId, dateKey, monthKey } };
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

function readDate(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function readMonthKey(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}

function readTime(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : null;
}

function readNullableTime(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : readTime(value);
}

function readActionKey(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text === "clock-in" || text === "clock-out" ? text : null;
}

function readNullableActionKey(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : readActionKey(value);
}

function readCommandStatus(value: unknown): "pending" | "claimed" | "succeeded" | "failed" | "expired" | "rejected" | "cancelled" | null {
  const text = String(value ?? "").trim();
  return text === "pending"
    || text === "claimed"
    || text === "succeeded"
    || text === "failed"
    || text === "expired"
    || text === "rejected"
    || text === "cancelled"
    ? text
    : null;
}

function readSeverity(value: unknown): "debug" | "info" | "warn" | "error" | null {
  const text = String(value ?? "").trim();
  return text === "debug" || text === "info" || text === "warn" || text === "error" ? text : null;
}

function readIsoDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readNullableText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" || looksLikeForbiddenContent(value)) {
    return null;
  }

  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function shortId(value: string): string {
  return value ? value.slice(0, 8) : "unknown";
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthBounds(value: string): { start: string; end: string } {
  const [year, month] = value.split("-").map((part) => Number(part));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(body: JsonObject, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
