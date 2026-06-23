import type {
  AttendanceActionType,
  AttendanceVerificationResult,
  PerakamObservedConfidence,
  PerakamObservedPageState,
  PerakamObservedSource,
  PerakamObservedValuesSnapshot,
  PerakamPageStatus
} from "../shared/types";

interface ExtractObservedInput {
  pageStatus: PerakamPageStatus;
  dashboardTiles?: DashboardTileObservation[];
  dashboardTileTexts?: string[];
  kadPerakamRows?: string[];
  observedAt: string;
  todayDateKey: string;
}

export interface DashboardTileObservation {
  action: "clock-in" | "clock-out";
  text: string;
  valueText: string | null;
  dateText: string | null;
  valueSelector: "#wm" | "#wk";
  visible?: boolean;
  inSidebar?: boolean;
}

const TIME_PATTERN = /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)?\b/i;
const PLACEHOLDER_VALUE_PATTERN = /^(\?|[-]+|n\/a|na)$/i;

export function emptyPerakamObservedValues(
  pageState: PerakamObservedPageState = "unknown",
  reason = "Perakam observed values have not been checked."
): PerakamObservedValuesSnapshot {
  return {
    observedDate: null,
    clockInTime: null,
    clockOutTime: null,
    source: "unknown",
    observedAt: null,
    pageState,
    confidence: "low",
    reason: sanitizeObservedReason(reason)
  };
}

export function extractPerakamObservedValues(input: ExtractObservedInput): PerakamObservedValuesSnapshot {
  const pageState = observedPageStateFromPerakamStatus(input.pageStatus);
  if (pageState !== "logged-in-dashboard") {
    return {
      ...emptyPerakamObservedValues(pageState, nonDashboardReason(pageState)),
      observedAt: input.observedAt
    };
  }

  const dashboard = extractFromDashboardTiles(input.dashboardTiles ?? [], input.dashboardTileTexts ?? []);
  if (dashboard.clockInTime || dashboard.clockOutTime || dashboard.seen) {
    return observedSnapshot({
      observedDate: dashboard.observedDate ?? input.todayDateKey,
      clockInTime: dashboard.clockInTime,
      clockOutTime: dashboard.clockOutTime,
      source: "dashboard-tile",
      observedAt: input.observedAt,
      pageState,
      reason: dashboard.reason
    });
  }

  const kad = extractFromKadPerakam(input.kadPerakamRows ?? [], input.todayDateKey);
  if (kad.clockInTime || kad.clockOutTime) {
    return observedSnapshot({
      observedDate: input.todayDateKey,
      clockInTime: kad.clockInTime,
      clockOutTime: kad.clockOutTime,
      source: "kad-perakam",
      observedAt: input.observedAt,
      pageState,
      reason: observedReason(kad.clockInTime, kad.clockOutTime, "Kad Perakam")
    });
  }

  return observedSnapshot({
    observedDate: input.todayDateKey,
    clockInTime: null,
    clockOutTime: null,
    source: "unknown",
    observedAt: input.observedAt,
    pageState,
    reason: "Perakam dashboard was visible, but no observed clock-in or clock-out value was found."
  });
}

export function observedPageStateFromPerakamStatus(status: PerakamPageStatus): PerakamObservedPageState {
  switch (status) {
    case "dashboard":
    case "likely-logged-in":
      return "logged-in-dashboard";
    case "login-required":
    case "likely-login-required":
      return "login-required";
    case "stale-session":
      return "stale-session";
    case "error":
    case "not-opened":
    case "loading":
      return "unreachable";
    default:
      return "unknown";
  }
}

export function observedStatusSummary(snapshot: PerakamObservedValuesSnapshot): string {
  const date = snapshot.observedDate ?? "--";
  const clockIn = snapshot.clockInTime ?? "--";
  const clockOut = snapshot.clockOutTime ?? "--";
  const observedAt = snapshot.observedAt ?? "--";
  return `observedPerakam=page:${snapshot.pageState},date:${date},in:${clockIn},out:${clockOut},source:${snapshot.source},at:${observedAt}`;
}

export function observedValueForAction(snapshot: PerakamObservedValuesSnapshot | null | undefined, action: AttendanceActionType): string | null {
  return action === "clock-in"
    ? snapshot?.clockInTime ?? null
    : snapshot?.clockOutTime ?? null;
}

export function verifyObservedAttendanceValue(input: {
  action: AttendanceActionType;
  dateKey: string;
  localClickResult: AttendanceVerificationResult["localClickResult"];
  before: PerakamObservedValuesSnapshot | null;
  after: PerakamObservedValuesSnapshot | null;
  sanitizedUrlAfterClick: string | null;
  checkedAt: string;
}): AttendanceVerificationResult {
  const beforeValue = observedValueForAction(input.before, input.action);
  const afterValue = observedValueForAction(input.after, input.action);
  const actionLabel = input.action === "clock-in" ? "clock-in" : "clock-out";
  const observedPageState = input.after?.pageState ?? input.before?.pageState ?? "unknown";
  const observedSource = input.after?.source ?? input.before?.source ?? "unknown";
  const observedAt = input.after?.observedAt ?? input.before?.observedAt ?? null;

  if (beforeValue) {
    return buildObservedVerification({
      ...input,
      status: "already-present",
      reason: `${actionLabel} was already present before the local action; observed website value ${beforeValue}.`,
      beforeValue,
      afterValue,
      observedPageState,
      observedSource,
      observedAt
    });
  }

  if (afterValue) {
    return buildObservedVerification({
      ...input,
      status: "verified-success",
      reason: `${actionLabel} verified from observed website value ${afterValue}.`,
      beforeValue,
      afterValue,
      observedPageState,
      observedSource,
      observedAt
    });
  }

  if (observedPageState === "logged-in-dashboard") {
    return buildObservedVerification({
      ...input,
      status: "verification-failed",
      reason: `${actionLabel} was still missing after bounded read-only verification on the logged-in dashboard.`,
      beforeValue,
      afterValue,
      observedPageState,
      observedSource,
      observedAt
    });
  }

  return buildObservedVerification({
    ...input,
    status: "verification-unknown",
    reason: `${actionLabel} could not be verified because Perakam page state was ${observedPageState}.`,
    beforeValue,
    afterValue,
    observedPageState,
    observedSource,
    observedAt
  });
}

function extractFromDashboardTiles(
  tiles: DashboardTileObservation[],
  texts: string[]
): { clockInTime: string | null; clockOutTime: string | null; observedDate: string | null; seen: boolean; reason: string } {
  const visibleTiles = tiles.filter((tile) => tile.visible !== false && !tile.inSidebar);
  const clockInTile = visibleTiles.find((tile) => tile.action === "clock-in");
  const clockOutTile = visibleTiles.find((tile) => tile.action === "clock-out");
  const clockInValue = tileValue(clockInTile);
  const clockOutValue = tileValue(clockOutTile);
  const observedDate = parseDateText(clockInTile?.dateText) ?? parseDateText(clockOutTile?.dateText);

  if (clockInTile || clockOutTile) {
    return {
      clockInTime: clockInValue,
      clockOutTime: clockOutValue,
      observedDate,
      seen: true,
      reason: dashboardTileReason(clockInTile, clockOutTile, clockInValue, clockOutValue)
    };
  }

  const safeTexts = texts.map(normalizeText).filter(Boolean);
  const combined = safeTexts.join(" ");
  const clockInTime = firstTimeAfterLabel(safeTexts, [/masa hadir/i, /klik masuk/i, /\ba50\b/i], [/masa keluar/i, /klik keluar/i, /\ba51\b/i]);
  const clockOutTime = firstTimeAfterLabel(safeTexts, [/masa keluar/i, /klik keluar/i, /\ba51\b/i], [/masa hadir/i, /klik masuk/i, /\ba50\b/i]);
  const seen = /masa hadir|a50|masa keluar|a51/i.test(combined);
  return {
    clockInTime,
    clockOutTime,
    observedDate: null,
    seen,
    reason: seen
      ? observedReason(clockInTime, clockOutTime, "Dashboard tile text fallback")
      : "Dashboard observed; no scoped dashboard tiles were found."
  };
}

function extractFromKadPerakam(rows: string[], todayDateKey: string): { clockInTime: string | null; clockOutTime: string | null } {
  const todayRows = rows.map(normalizeText).filter((row) => row.includes(todayDateKey));
  if (todayRows.length === 0) {
    return { clockInTime: null, clockOutTime: null };
  }

  return {
    clockInTime: firstTimeAfterLabel(todayRows, [/masa hadir/i, /clock[- ]?in/i], [/masa keluar/i, /clock[- ]?out/i]) ?? firstTime(todayRows[0] ?? ""),
    clockOutTime: firstTimeAfterLabel(todayRows, [/masa keluar/i, /clock[- ]?out/i], [/masa hadir/i, /clock[- ]?in/i])
  };
}

function firstTimeAfterLabel(texts: string[], labels: RegExp[], stopLabels: RegExp[]): string | null {
  for (const text of texts) {
    const labelMatch = firstMatch(text, labels);
    if (!labelMatch) {
      continue;
    }

    let segment = text.slice(labelMatch.index);
    const stopMatch = firstMatch(segment.slice(labelMatch.length), stopLabels);
    if (stopMatch && stopMatch.index > 0) {
      segment = segment.slice(0, labelMatch.length + stopMatch.index);
    }

    const found = firstTime(segment);
    if (found) {
      return found;
    }
  }

  return null;
}

function firstMatch(text: string, patterns: RegExp[]): { index: number; length: number } | null {
  const matches = patterns
    .map((pattern) => {
      const match = pattern.exec(text);
      return match ? { index: match.index, length: match[0].length } : null;
    })
    .filter((match): match is { index: number; length: number } => Boolean(match))
    .sort((a, b) => a.index - b.index);
  return matches[0] ?? null;
}

function firstTime(text: string): string | null {
  const match = TIME_PATTERN.exec(text);
  if (!match) {
    return null;
  }

  let hourValue = Number.parseInt(match[1], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hourValue < 12) {
    hourValue += 12;
  }
  if (meridiem === "AM" && hourValue === 12) {
    hourValue = 0;
  }

  const hour = String(hourValue).padStart(2, "0");
  return `${hour}:${match[2]}`;
}

function tileValue(tile: DashboardTileObservation | undefined): string | null {
  if (!tile) {
    return null;
  }

  return firstMeaningfulTime(tile.valueText) ?? firstMeaningfulTime(tile.text);
}

function firstMeaningfulTime(value: string | null | undefined): string | null {
  const text = normalizeText(value ?? "");
  if (!text || PLACEHOLDER_VALUE_PATTERN.test(text)) {
    return null;
  }

  return firstTime(text);
}

function parseDateText(value: string | null | undefined): string | null {
  const text = normalizeText(value ?? "");
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const local = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/.exec(text);
  if (local) {
    return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }

  return null;
}

function dashboardTileReason(
  clockInTile: DashboardTileObservation | undefined,
  clockOutTile: DashboardTileObservation | undefined,
  clockInTime: string | null,
  clockOutTime: string | null
): string {
  const parts = [
    "dashboard observed",
    clockInTile ? "clock-in tile found" : "clock-in tile missing",
    clockOutTile ? "clock-out tile found" : "clock-out tile missing"
  ];

  if (clockInTime) {
    parts.push(`clock-in value ${clockInTime} from #wm`);
  } else if (clockInTile) {
    parts.push("clock-in missing placeholder from #wm");
  }

  if (clockOutTime) {
    parts.push(`clock-out value ${clockOutTime} from #wk`);
  } else if (clockOutTile) {
    parts.push("clock-out missing placeholder from #wk");
  }

  if (!clockInTime && !clockOutTime) {
    parts.push("values missing or placeholder");
  }

  return parts.join("; ");
}

function buildObservedVerification(input: {
  action: AttendanceActionType;
  dateKey: string;
  localClickResult: AttendanceVerificationResult["localClickResult"];
  status: AttendanceVerificationResult["status"];
  reason: string;
  sanitizedUrlAfterClick: string | null;
  checkedAt: string;
  beforeValue: string | null;
  afterValue: string | null;
  observedPageState: PerakamObservedPageState;
  observedSource: PerakamObservedSource;
  observedAt: string | null;
}): AttendanceVerificationResult {
  const evidenceSnippets = safeObservedEvidence([
    `before=${input.beforeValue ?? "--"}`,
    `after=${input.afterValue ?? "--"}`,
    `page=${input.observedPageState}`,
    `source=${input.observedSource}`,
    input.observedAt ? `observedAt=${input.observedAt}` : ""
  ]);

  return {
    action: input.action,
    dateKey: input.dateKey,
    localClickResult: input.localClickResult,
    status: input.status,
    reason: sanitizeObservedReason(input.reason) ?? "Post-action observed value verification finished without sensitive details.",
    sanitizedUrlAfterClick: sanitizeObservedReason(input.sanitizedUrlAfterClick),
    evidenceSnippets,
    checkedAt: input.checkedAt,
    observedValueBefore: input.beforeValue,
    observedValueAfter: input.afterValue,
    observedPageState: input.observedPageState,
    observedSource: input.observedSource,
    observedAt: input.observedAt
  };
}

function safeObservedEvidence(values: string[]): string[] {
  return values
    .map((value) => sanitizeObservedReason(value))
    .filter((value): value is string => Boolean(value))
    .slice(0, 6);
}

function observedSnapshot(input: Omit<PerakamObservedValuesSnapshot, "confidence">): PerakamObservedValuesSnapshot {
  return {
    ...input,
    confidence: observedConfidence(input.clockInTime, input.clockOutTime),
    reason: sanitizeObservedReason(input.reason)
  };
}

function observedConfidence(clockInTime: string | null, clockOutTime: string | null): PerakamObservedConfidence {
  if (clockInTime && clockOutTime) {
    return "high";
  }

  if (clockInTime || clockOutTime) {
    return "medium";
  }

  return "low";
}

function observedReason(clockInTime: string | null, clockOutTime: string | null, source: string): string {
  if (clockInTime && clockOutTime) {
    return `${source} observation found clock-in and clock-out values.`;
  }

  if (clockInTime) {
    return `${source} observation found clock-in value only.`;
  }

  if (clockOutTime) {
    return `${source} observation found clock-out value only.`;
  }

  return `${source} markers were visible, but no time value was found.`;
}

function nonDashboardReason(pageState: PerakamObservedPageState): string {
  switch (pageState) {
    case "login-required":
      return "Perakam login is required; observed attendance times were not read.";
    case "stale-session":
      return "Perakam session is stale; observed attendance times were not read.";
    case "unreachable":
      return "Perakam page is not reachable in the current browser session.";
    default:
      return "Perakam page state is unknown; observed attendance times were not read.";
  }
}

function normalizeText(value: string): string {
  return sanitizeObservedReason(value) ?? "";
}

function sanitizeObservedReason(value: string | null | undefined): string | null {
  const sanitized = String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/\?(token|code|session|link|magic|4Tredir)=[^\s]*/gi, "?[redacted]")
    .replace(/#(access_token|id_token|token)=[^\s]*/gi, "#[redacted]")
    .replace(/\blink=[^\s&]+/gi, "[redacted-link]")
    .replace(/\bmagic=[^\s&]+/gi, "[redacted-magic]")
    .replace(/\b4Tredir=[^\s&]+/gi, "[redacted-redirect]")
    .replace(/\b(cookie|password|credential|token|bearer)\b\s*[:=]?\s*[^\s]*/gi, "$1 [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  return sanitized || null;
}
