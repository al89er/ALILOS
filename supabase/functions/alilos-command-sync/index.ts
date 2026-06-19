import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;
type Operation = "list-pending" | "create-command" | "claim-command" | "complete-command" | "append-command-event";
type ActionKey = "clock-in" | "clock-out";
type CommandType =
  | "request-status-refresh"
  | "request-dry-run"
  | "request-confirmation"
  | "cancel-confirmation"
  | "perform-configured-action"
  | "recalculate-today-schedule";
type CommandStatus = "pending" | "claimed" | "succeeded" | "failed" | "expired" | "rejected" | "cancelled";
type FinalCommandStatus = "succeeded" | "failed" | "expired" | "rejected" | "cancelled";
type CommandEventType = "created" | "claimed" | "progress" | "succeeded" | "failed" | "expired" | "rejected" | "cancelled";

interface CommandSyncRequest {
  deviceId: string;
  operation: Operation;
  commandId: string | null;
  commandType: CommandType | null;
  actionKey: ActionKey | null;
  scheduleDate: string | null;
  commandPayload: Record<string, string | number | boolean | null>;
  status: FinalCommandStatus | null;
  summary: string | null;
  details: Record<string, string | number | boolean | null>;
  event: {
    eventType: CommandEventType;
    message: string;
    details: Record<string, string | number | boolean | null>;
  } | null;
}

const OPERATIONS = new Set(["list-pending", "create-command", "claim-command", "complete-command", "append-command-event"]);
const ACTION_KEYS = new Set(["clock-in", "clock-out"]);
const COMMAND_TYPES = new Set([
  "request-status-refresh",
  "request-dry-run",
  "request-confirmation",
  "cancel-confirmation",
  "perform-configured-action",
  "recalculate-today-schedule"
]);
const PARITY7_ALLOWED_COMMAND_TYPES = new Set([
  "request-status-refresh",
  "request-dry-run",
  "cancel-confirmation",
  "recalculate-today-schedule"
]);
const CREATE_COMMAND_TYPES = new Set([
  "request-status-refresh",
  "request-dry-run",
  "cancel-confirmation",
  "recalculate-today-schedule"
]);
const FINAL_STATUSES = new Set(["succeeded", "failed", "expired", "rejected", "cancelled"]);
const EVENT_TYPES = new Set(["created", "claimed", "progress", "succeeded", "failed", "expired", "rejected", "cancelled"]);
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

  if (payload.operation === "list-pending") {
    const { data, error } = await supabase
      .from("command_requests")
      .select("id, device_id, command_type, action_key, schedule_date, payload, status, requested_at, expires_at")
      .eq("device_id", payload.deviceId)
      .eq("status", "pending")
      .gt("expires_at", acceptedAt)
      .in("command_type", [...PARITY7_ALLOWED_COMMAND_TYPES])
      .order("requested_at", { ascending: true })
      .limit(10);

    if (error) {
      return jsonResponse({ success: false, error: "command-list-failed" }, 500);
    }

    return jsonResponse({
      success: true,
      operation: payload.operation,
      acceptedAt,
      commands: (data ?? []).map((row) => commandRowToPayload(row, acceptedAt))
    }, 200);
  }

  if (payload.operation === "create-command") {
    if (!payload.commandType || !CREATE_COMMAND_TYPES.has(payload.commandType)) {
      return jsonResponse({ success: false, error: "unsupported-command-type" }, 400);
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("command_requests")
      .insert({
        device_id: payload.deviceId,
        command_type: payload.commandType,
        action_key: payload.actionKey,
        schedule_date: payload.scheduleDate,
        payload: payload.commandPayload,
        status: "pending",
        requested_by: "webapp",
        requested_at: acceptedAt,
        expires_at: expiresAt
      })
      .select("id, status, requested_at, expires_at")
      .single();

    if (error || !data) {
      return jsonResponse({ success: false, error: "command-create-failed" }, 500);
    }

    await appendCommandEvent(supabase, payload.deviceId, readUuid(data.id) ?? "00000000-0000-4000-8000-000000000000", "created", "Safe web command created.", {
      commandType: payload.commandType,
      source: "webapp",
      noConfiguredSiteAction: true
    });

    return jsonResponse({
      success: true,
      operation: payload.operation,
      acceptedAt,
      command: {
        id: readUuid(data.id) ?? "00000000-0000-4000-8000-000000000000",
        status: readCommandStatus(data.status) ?? "pending",
        requestedAt: readIsoDate(data.requested_at) ?? acceptedAt,
        expiresAt: readIsoDate(data.expires_at) ?? expiresAt
      }
    }, 202);
  }

  if (!payload.commandId) {
    return jsonResponse({ success: false, error: "missing-command-id" }, 400);
  }

  if (payload.operation === "claim-command") {
    const { data, error } = await supabase
      .from("command_requests")
      .update({
        status: "claimed",
        claimed_at: acceptedAt
      })
      .eq("id", payload.commandId)
      .eq("device_id", payload.deviceId)
      .eq("status", "pending")
      .gt("expires_at", acceptedAt)
      .in("command_type", [...PARITY7_ALLOWED_COMMAND_TYPES])
      .select("id, device_id, command_type, action_key, schedule_date, payload, status, requested_at, expires_at")
      .maybeSingle();

    if (error) {
      return jsonResponse({ success: false, error: "command-claim-failed" }, 500);
    }

    if (!data) {
      return jsonResponse({ success: true, operation: payload.operation, acceptedAt, command: null }, 200);
    }

    await appendCommandEvent(supabase, payload.deviceId, payload.commandId, "claimed", "Command claimed by desktop.", {
      source: "desktop",
      noConfiguredSiteAction: true
    });

    return jsonResponse({
      success: true,
      operation: payload.operation,
      acceptedAt,
      command: commandRowToPayload(data, acceptedAt)
    }, 200);
  }

  if (payload.operation === "complete-command") {
    if (!payload.status || !payload.summary) {
      return jsonResponse({ success: false, error: "missing-result-fields" }, 400);
    }

    const { error } = await supabase
      .from("command_requests")
      .update({
        status: payload.status,
        completed_at: acceptedAt,
        result_summary: payload.summary,
        result_details: payload.details
      })
      .eq("id", payload.commandId)
      .eq("device_id", payload.deviceId)
      .in("status", ["pending", "claimed"]);

    if (error) {
      return jsonResponse({ success: false, error: "command-complete-failed" }, 500);
    }

    await appendCommandEvent(supabase, payload.deviceId, payload.commandId, payload.status, payload.summary, payload.details);

    return jsonResponse({
      success: true,
      operation: payload.operation,
      acceptedAt,
      status: payload.status
    }, 202);
  }

  if (!payload.event) {
    return jsonResponse({ success: false, error: "missing-event-fields" }, 400);
  }

  const eventError = await appendCommandEvent(
    supabase,
    payload.deviceId,
    payload.commandId,
    payload.event.eventType,
    payload.event.message,
    payload.event.details
  );

  if (eventError) {
    return jsonResponse({ success: false, error: "command-event-failed" }, 500);
  }

  return jsonResponse({
    success: true,
    operation: payload.operation,
    acceptedAt
  }, 202);
});

async function appendCommandEvent(
  supabase: ReturnType<typeof createClient>,
  deviceId: string,
  commandId: string,
  eventType: CommandEventType | FinalCommandStatus,
  message: string,
  details: Record<string, string | number | boolean | null>
): Promise<unknown> {
  const { error } = await supabase
    .from("command_events")
    .insert({
      command_id: commandId,
      device_id: deviceId,
      event_type: eventType,
      message,
      details
    });

  return error;
}

function commandRowToPayload(row: JsonObject, fallbackTime: string): JsonObject {
  return {
    id: readUuid(row.id) ?? "00000000-0000-4000-8000-000000000000",
    deviceId: readUuid(row.device_id) ?? "00000000-0000-4000-8000-000000000000",
    commandType: readCommandType(row.command_type) ?? "request-status-refresh",
    actionKey: readNullableActionKey(row.action_key),
    scheduleDate: readNullableDate(row.schedule_date),
    payload: readJsonDetails(row.payload) ?? {},
    status: readCommandStatus(row.status) ?? "pending",
    requestedAt: readIsoDate(row.requested_at) ?? fallbackTime,
    expiresAt: readIsoDate(row.expires_at) ?? fallbackTime
  };
}

function validateRequestBody(value: unknown): { ok: true; payload: CommandSyncRequest } | { ok: false; error: string } {
  if (!isPlainObject(value)) {
    return { ok: false, error: "invalid-body" };
  }

  if (containsForbiddenKeyOrValue(value)) {
    return { ok: false, error: "forbidden-content" };
  }

  const body = value as JsonObject;
  const deviceId = readUuid(body.deviceId);
  const operation = readOperation(body.operation);
  const commandId = body.commandId === undefined || body.commandId === null ? null : readUuid(body.commandId);
  const commandType = body.commandType === undefined || body.commandType === null ? null : readCommandType(body.commandType);
  const actionKey = body.actionKey === undefined || body.actionKey === null ? null : readNullableActionKey(body.actionKey);
  const scheduleDate = body.scheduleDate === undefined || body.scheduleDate === null ? null : readNullableDate(body.scheduleDate);
  const commandPayload = body.payload === undefined || body.payload === null ? {} : readJsonDetails(body.payload);
  const status = body.status === undefined || body.status === null ? null : readFinalStatus(body.status);
  const summary = body.summary === undefined || body.summary === null ? null : readNullableText(body.summary, 500);
  const details = body.details === undefined || body.details === null ? {} : readJsonDetails(body.details);
  const event = body.event === undefined || body.event === null ? null : readCommandEvent(body.event);

  if (!deviceId) {
    return { ok: false, error: "invalid-device-id" };
  }

  if (!operation) {
    return { ok: false, error: "invalid-operation" };
  }

  if (body.commandId !== undefined && body.commandId !== null && !commandId) {
    return { ok: false, error: "invalid-command-id" };
  }

  if (body.commandType !== undefined && body.commandType !== null && !commandType) {
    return { ok: false, error: "invalid-command-type" };
  }

  if (body.actionKey !== undefined && body.actionKey !== null && !actionKey) {
    return { ok: false, error: "invalid-action-key" };
  }

  if (body.scheduleDate !== undefined && body.scheduleDate !== null && !scheduleDate) {
    return { ok: false, error: "invalid-schedule-date" };
  }

  if (!commandPayload) {
    return { ok: false, error: "invalid-payload" };
  }

  if (body.status !== undefined && body.status !== null && !status) {
    return { ok: false, error: "invalid-status" };
  }

  if (body.summary !== undefined && body.summary !== null && !summary) {
    return { ok: false, error: "invalid-summary" };
  }

  if (!details) {
    return { ok: false, error: "invalid-details" };
  }

  if (body.event !== undefined && body.event !== null && !event) {
    return { ok: false, error: "invalid-event" };
  }

  if ((operation === "claim-command" || operation === "complete-command" || operation === "append-command-event") && !commandId) {
    return { ok: false, error: "missing-command-id" };
  }

  if (operation === "create-command" && !commandType) {
    return { ok: false, error: "missing-command-type" };
  }

  if (operation === "complete-command" && (!status || !summary)) {
    return { ok: false, error: "missing-result-fields" };
  }

  if (operation === "append-command-event" && !event) {
    return { ok: false, error: "missing-event-fields" };
  }

  return { ok: true, payload: { deviceId, operation, commandId, commandType, actionKey, scheduleDate, commandPayload, status, summary, details, event } };
}

function readCommandEvent(value: unknown): CommandSyncRequest["event"] | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const eventType = readEventType(value.eventType);
  const message = readNullableText(value.message, 500);
  const details = value.details === undefined || value.details === null ? {} : readJsonDetails(value.details);

  return eventType && message && details
    ? { eventType, message, details }
    : null;
}

function readJsonDetails(value: unknown): Record<string, string | number | boolean | null> | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const details: Record<string, string | number | boolean | null> = {};
  for (const [key, nestedValue] of Object.entries(value).slice(0, 20)) {
    if (isForbiddenKey(key)) {
      return null;
    }

    const sanitizedKey = key.trim().slice(0, 80);
    if (!sanitizedKey) {
      continue;
    }

    if (typeof nestedValue === "string") {
      const text = readNullableText(nestedValue, 240);
      if (text === null) {
        return null;
      }
      details[sanitizedKey] = text;
    } else if (typeof nestedValue === "number" || typeof nestedValue === "boolean" || nestedValue === null) {
      details[sanitizedKey] = nestedValue;
    } else {
      return null;
    }
  }

  return details;
}

function containsForbiddenKeyOrValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return true;
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

function readCommandType(value: unknown): CommandType | null {
  const text = String(value ?? "").trim();
  return COMMAND_TYPES.has(text) ? text as CommandType : null;
}

function readCommandStatus(value: unknown): CommandStatus | null {
  const text = String(value ?? "").trim();
  return text === "pending"
    || text === "claimed"
    || FINAL_STATUSES.has(text)
    ? text as CommandStatus
    : null;
}

function readFinalStatus(value: unknown): FinalCommandStatus | null {
  const text = String(value ?? "").trim();
  return FINAL_STATUSES.has(text) ? text as FinalCommandStatus : null;
}

function readEventType(value: unknown): CommandEventType | null {
  const text = String(value ?? "").trim();
  return EVENT_TYPES.has(text) ? text as CommandEventType : null;
}

function readNullableActionKey(value: unknown): ActionKey | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();
  return ACTION_KEYS.has(text) ? text as ActionKey : null;
}

function readNullableDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
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
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
