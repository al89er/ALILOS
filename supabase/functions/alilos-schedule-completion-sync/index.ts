import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

type JsonObject = Record<string, unknown>;
type Operation = "get-day-state" | "upsert-schedule" | "upsert-completion";
type ActionKey = "clock-in" | "clock-out";
type ScheduleSource = "local-generated" | "recovered-from-supabase" | "manual-reconciled";
type ScheduleStatus = "active" | "skipped" | "superseded" | "archived";
type CompletionState =
  | "not-attempted"
  | "click-attempted"
  | "click-succeeded-local"
  | "verification-pending"
  | "verified-success"
  | "verification-unknown"
  | "verification-failed"
  | "manually-verified";
type VerificationState = "pending" | "verified-success" | "verification-unknown" | "verification-failed" | "manually-verified";

interface RequestPayload {
  deviceId: string;
  operation: Operation;
  scheduleDate: string | null;
  actionDate: string | null;
  actionKey: ActionKey | null;
  schedule: SchedulePayload | null;
  completion: CompletionPayload | null;
}

interface SchedulePayload {
  targetTimeLocal: string;
  windowStartLocal: string | null;
  windowEndLocal: string | null;
  source: ScheduleSource;
  status: ScheduleStatus;
}

interface CompletionPayload {
  dedupeKey: string | null;
  state: CompletionState;
  verificationState: VerificationState | null;
  sanitizedReason: string | null;
  attemptedAt: string | null;
  verifiedAt: string | null;
}

const OPERATIONS = new Set(["get-day-state", "upsert-schedule", "upsert-completion"]);
const ACTION_KEYS = new Set(["clock-in", "clock-out"]);
const SCHEDULE_SOURCES = new Set(["local-generated", "recovered-from-supabase", "manual-reconciled"]);
const SCHEDULE_STATUSES = new Set(["active", "skipped", "superseded", "archived"]);
const COMPLETION_STATES = new Set([
  "not-attempted",
  "click-attempted",
  "click-succeeded-local",
  "verification-pending",
  "verified-success",
  "verification-unknown",
  "verification-failed",
  "manually-verified"
]);
const VERIFICATION_STATES = new Set(["pending", "verified-success", "verification-unknown", "verification-failed", "manually-verified"]);
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
  "link",
  "payload"
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

  const payload = validation.payload;
  const acceptedAt = new Date().toISOString();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("device_id")
    .eq("device_id", payload.deviceId)
    .maybeSingle();

  if (deviceError) {
    return jsonResponse({ success: false, error: "device-check-failed" }, 500);
  }

  if (!device) {
    return jsonResponse({ success: false, error: "device-not-registered" }, 404);
  }

  if (payload.operation === "get-day-state") {
    const day = payload.scheduleDate ?? payload.actionDate;
    if (!day) {
      return jsonResponse({ success: false, error: "missing-date" }, 400);
    }

    const schedules = await supabase
      .from("daily_schedules")
      .select("schedule_date, action_key, target_time_local, window_start_local, window_end_local, source, status, updated_at")
      .eq("device_id", payload.deviceId)
      .eq("schedule_date", day)
      .order("action_key", { ascending: true });

    if (schedules.error) {
      return jsonResponse({ success: false, error: "schedule-list-failed" }, 500);
    }

    const completions = await supabase
      .from("completion_records")
      .select("action_date, action_key, dedupe_key, state, verification_state, sanitized_reason, attempted_at, verified_at, updated_at")
      .eq("device_id", payload.deviceId)
      .eq("action_date", day)
      .order("action_key", { ascending: true });

    if (completions.error) {
      return jsonResponse({ success: false, error: "completion-list-failed" }, 500);
    }

    return jsonResponse({
      success: true,
      operation: payload.operation,
      acceptedAt,
      schedules: (schedules.data ?? []).map((row) => ({
        deviceId: payload.deviceId,
        scheduleDate: readDateText(row.schedule_date) ?? day,
        actionKey: readActionKey(row.action_key) ?? "clock-in",
        targetTimeLocal: readTimeText(row.target_time_local) ?? "00:00",
        windowStartLocal: readNullableTimeText(row.window_start_local),
        windowEndLocal: readNullableTimeText(row.window_end_local),
        source: readScheduleSource(row.source) ?? "local-generated",
        status: readScheduleStatus(row.status) ?? "active",
        updatedAt: readIsoDate(row.updated_at) ?? acceptedAt
      })),
      completions: (completions.data ?? []).map((row) => ({
        deviceId: payload.deviceId,
        actionDate: readDateText(row.action_date) ?? day,
        actionKey: readActionKey(row.action_key) ?? "clock-in",
        dedupeKey: readNullableText(row.dedupe_key, 220),
        state: readCompletionState(row.state) ?? "not-attempted",
        verificationState: readNullableVerificationState(row.verification_state),
        sanitizedReason: readNullableText(row.sanitized_reason, 500),
        attemptedAt: readIsoDate(row.attempted_at),
        verifiedAt: readIsoDate(row.verified_at),
        updatedAt: readIsoDate(row.updated_at) ?? acceptedAt
      }))
    }, 200);
  }

  if (payload.operation === "upsert-schedule") {
    if (!payload.scheduleDate || !payload.actionKey || !payload.schedule) {
      return jsonResponse({ success: false, error: "missing-schedule-fields" }, 400);
    }

    const { error } = await supabase
      .from("daily_schedules")
      .upsert({
        device_id: payload.deviceId,
        schedule_date: payload.scheduleDate,
        action_key: payload.actionKey,
        target_time_local: payload.schedule.targetTimeLocal,
        window_start_local: payload.schedule.windowStartLocal,
        window_end_local: payload.schedule.windowEndLocal,
        source: payload.schedule.source,
        status: payload.schedule.status
      }, { onConflict: "device_id,schedule_date,action_key" });

    if (error) {
      return jsonResponse({ success: false, error: "schedule-upsert-failed" }, 500);
    }

    return jsonResponse({ success: true, operation: payload.operation, acceptedAt, affectedCount: 1 }, 202);
  }

  if (!payload.actionDate || !payload.actionKey || !payload.completion) {
    return jsonResponse({ success: false, error: "missing-completion-fields" }, 400);
  }

  const { error } = await supabase
    .from("completion_records")
    .upsert({
      device_id: payload.deviceId,
      action_date: payload.actionDate,
      action_key: payload.actionKey,
      dedupe_key: payload.completion.dedupeKey,
      state: payload.completion.state,
      verification_state: payload.completion.verificationState,
      sanitized_reason: payload.completion.sanitizedReason,
      attempted_at: payload.completion.attemptedAt,
      verified_at: payload.completion.verifiedAt
    }, { onConflict: "device_id,action_date,action_key" });

  if (error) {
    return jsonResponse({ success: false, error: "completion-upsert-failed" }, 500);
  }

  return jsonResponse({ success: true, operation: payload.operation, acceptedAt, affectedCount: 1 }, 202);
});

function validateRequestBody(value: unknown): { ok: true; payload: RequestPayload } | { ok: false; error: string } {
  if (!isPlainObject(value)) {
    return { ok: false, error: "invalid-body" };
  }

  if (containsForbiddenKeyOrValue(value)) {
    return { ok: false, error: "forbidden-content" };
  }

  const body = value as JsonObject;
  const deviceId = readUuid(body.deviceId);
  const operation = readOperation(body.operation);
  const scheduleDate = readNullableDate(body.scheduleDate);
  const actionDate = readNullableDate(body.actionDate);
  const actionKey = readNullableActionKey(body.actionKey);

  if (!deviceId) {
    return { ok: false, error: "invalid-device-id" };
  }

  if (!operation) {
    return { ok: false, error: "invalid-operation" };
  }

  if (body.actionKey !== undefined && body.actionKey !== null && !actionKey) {
    return { ok: false, error: "invalid-action-key" };
  }

  const schedule = body.schedule === undefined || body.schedule === null ? null : readSchedule(body.schedule);
  if (body.schedule !== undefined && body.schedule !== null && !schedule) {
    return { ok: false, error: "invalid-schedule" };
  }

  const completion = body.completion === undefined || body.completion === null ? null : readCompletion(body.completion);
  if (body.completion !== undefined && body.completion !== null && !completion) {
    return { ok: false, error: "invalid-completion" };
  }

  if (operation === "get-day-state" && !scheduleDate && !actionDate) {
    return { ok: false, error: "missing-date" };
  }

  if (operation === "upsert-schedule" && (!scheduleDate || !actionKey || !schedule)) {
    return { ok: false, error: "missing-schedule-fields" };
  }

  if (operation === "upsert-completion" && (!actionDate || !actionKey || !completion)) {
    return { ok: false, error: "missing-completion-fields" };
  }

  return { ok: true, payload: { deviceId, operation, scheduleDate, actionDate, actionKey, schedule, completion } };
}

function readSchedule(value: unknown): SchedulePayload | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const targetTimeLocal = readTimeText(value.targetTimeLocal);
  const windowStartLocal = readNullableTimeText(value.windowStartLocal);
  const windowEndLocal = readNullableTimeText(value.windowEndLocal);
  const source = readScheduleSource(value.source);
  const status = readScheduleStatus(value.status);

  return targetTimeLocal && source && status
    ? { targetTimeLocal, windowStartLocal, windowEndLocal, source, status }
    : null;
}

function readCompletion(value: unknown): CompletionPayload | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const state = readCompletionState(value.state);
  if (!state) {
    return null;
  }

  return {
    dedupeKey: readNullableText(value.dedupeKey, 220),
    state,
    verificationState: readNullableVerificationState(value.verificationState),
    sanitizedReason: readNullableText(value.sanitizedReason, 500),
    attemptedAt: readIsoDate(value.attemptedAt),
    verifiedAt: readIsoDate(value.verifiedAt)
  };
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

function readOperation(value: unknown): Operation | null {
  const text = String(value ?? "").trim();
  return OPERATIONS.has(text) ? text as Operation : null;
}

function readActionKey(value: unknown): ActionKey | null {
  const text = String(value ?? "").trim();
  return ACTION_KEYS.has(text) ? text as ActionKey : null;
}

function readNullableActionKey(value: unknown): ActionKey | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return readActionKey(value);
}

function readScheduleSource(value: unknown): ScheduleSource | null {
  const text = String(value ?? "").trim();
  return SCHEDULE_SOURCES.has(text) ? text as ScheduleSource : null;
}

function readScheduleStatus(value: unknown): ScheduleStatus | null {
  const text = String(value ?? "").trim();
  return SCHEDULE_STATUSES.has(text) ? text as ScheduleStatus : null;
}

function readCompletionState(value: unknown): CompletionState | null {
  const text = String(value ?? "").trim();
  return COMPLETION_STATES.has(text) ? text as CompletionState : null;
}

function readNullableVerificationState(value: unknown): VerificationState | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();
  return VERIFICATION_STATES.has(text) ? text as VerificationState : null;
}

function readNullableDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return readDateText(value);
}

function readDateText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function readTimeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text.slice(0, 16) : null;
}

function readNullableTimeText(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return readTimeText(value);
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
