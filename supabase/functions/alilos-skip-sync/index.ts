import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

type JsonObject = Record<string, unknown>;
type SkipOperation = "list-skips" | "upsert-skip" | "delete-skip";
type SkipSource = "desktop-local" | "webapp-command" | "manual-import";
type ActionKey = "clock-in" | "clock-out";

interface SkipSyncRequest {
  deviceId: string;
  operation: SkipOperation;
  skipDate: string | null;
  actionKey: ActionKey | null;
  reason: string | null;
  source: SkipSource;
}

const OPERATIONS = new Set(["list-skips", "upsert-skip", "delete-skip"]);
const SOURCES = new Set(["desktop-local", "webapp-command", "manual-import"]);
const ACTION_KEYS = new Set(["clock-in", "clock-out"]);
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

  if (payload.operation === "list-skips") {
    const { data, error } = await supabase
      .from("skip_dates")
      .select("skip_date, action_key, reason, source, updated_at")
      .eq("device_id", payload.deviceId)
      .gte("skip_date", todayDateKey())
      .order("skip_date", { ascending: true });

    if (error) {
      return jsonResponse({ success: false, error: "skip-list-failed" }, 500);
    }

    return jsonResponse({
      success: true,
      operation: payload.operation,
      acceptedAt,
      skips: (data ?? []).map((row) => ({
        deviceId: payload.deviceId,
        skipDate: readDateText(row.skip_date) ?? todayDateKey(),
        actionKey: row.action_key === "clock-in" || row.action_key === "clock-out" ? row.action_key : null,
        reason: readNullableText(row.reason, 500),
        source: SOURCES.has(String(row.source)) ? row.source : "manual-import",
        updatedAt: readIsoDate(row.updated_at) ?? acceptedAt
      }))
    }, 200);
  }

  if (!payload.skipDate) {
    return jsonResponse({ success: false, error: "missing-skip-date" }, 400);
  }

  if (payload.operation === "upsert-skip") {
    const { error } = await supabase
      .from("skip_dates")
      .upsert({
        device_id: payload.deviceId,
        skip_date: payload.skipDate,
        action_key: payload.actionKey,
        reason: payload.reason,
        source: payload.source
      }, { onConflict: "device_id,skip_date,action_key_normalized" });

    if (error) {
      return jsonResponse({ success: false, error: "skip-upsert-failed" }, 500);
    }

    return jsonResponse({
      success: true,
      operation: payload.operation,
      acceptedAt,
      affectedCount: 1
    }, 202);
  }

  let deleteQuery = supabase
    .from("skip_dates")
    .delete({ count: "exact" })
    .eq("device_id", payload.deviceId)
    .eq("skip_date", payload.skipDate);

  deleteQuery = payload.actionKey ? deleteQuery.eq("action_key", payload.actionKey) : deleteQuery.is("action_key", null);
  const { count, error } = await deleteQuery;

  if (error) {
    return jsonResponse({ success: false, error: "skip-delete-failed" }, 500);
  }

  return jsonResponse({
    success: true,
    operation: payload.operation,
    acceptedAt,
    affectedCount: count ?? 0
  }, 200);
});

function validateRequestBody(value: unknown): { ok: true; payload: SkipSyncRequest } | { ok: false; error: string } {
  if (!isPlainObject(value)) {
    return { ok: false, error: "invalid-body" };
  }

  if (containsForbiddenKeyOrValue(value)) {
    return { ok: false, error: "forbidden-content" };
  }

  const body = value as JsonObject;
  const deviceId = readUuid(body.deviceId);
  const operation = readOperation(body.operation);
  const skipDate = readNullableDate(body.skipDate);
  const actionKey = readNullableActionKey(body.actionKey);
  const reason = readNullableText(body.reason, 500);
  const source = readSource(body.source);

  if (!deviceId) {
    return { ok: false, error: "invalid-device-id" };
  }

  if (!operation) {
    return { ok: false, error: "invalid-operation" };
  }

  if ((operation === "upsert-skip" || operation === "delete-skip") && !skipDate) {
    return { ok: false, error: "invalid-skip-date" };
  }

  if (body.actionKey !== undefined && body.actionKey !== null && !actionKey) {
    return { ok: false, error: "invalid-action-key" };
  }

  if (body.source !== undefined && !source) {
    return { ok: false, error: "invalid-source" };
  }

  if (body.reason !== undefined && body.reason !== null && reason === null) {
    return { ok: false, error: "invalid-reason" };
  }

  return {
    ok: true,
    payload: {
      deviceId,
      operation,
      skipDate,
      actionKey,
      reason,
      source: source ?? "desktop-local"
    }
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

function readOperation(value: unknown): SkipOperation | null {
  const text = String(value ?? "").trim();
  return OPERATIONS.has(text) ? text as SkipOperation : null;
}

function readSource(value: unknown): SkipSource | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();
  return SOURCES.has(text) ? text as SkipSource : null;
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

  return readDateText(value);
}

function readDateText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function readIsoDate(value: unknown): string | null {
  const date = new Date(String(value ?? ""));
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

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
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
