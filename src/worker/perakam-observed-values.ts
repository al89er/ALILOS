import type {
  PerakamObservedConfidence,
  PerakamObservedPageState,
  PerakamObservedSource,
  PerakamObservedValuesSnapshot,
  PerakamPageStatus
} from "../shared/types";

interface ExtractObservedInput {
  pageStatus: PerakamPageStatus;
  dashboardTileTexts?: string[];
  kadPerakamRows?: string[];
  observedAt: string;
  todayDateKey: string;
}

const TIME_PATTERN = /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?\b/;

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

  const dashboard = extractFromDashboardTiles(input.dashboardTileTexts ?? []);
  if (dashboard.clockInTime || dashboard.clockOutTime || dashboard.seen) {
    return observedSnapshot({
      observedDate: input.todayDateKey,
      clockInTime: dashboard.clockInTime,
      clockOutTime: dashboard.clockOutTime,
      source: "dashboard-tile",
      observedAt: input.observedAt,
      pageState,
      reason: observedReason(dashboard.clockInTime, dashboard.clockOutTime, "Dashboard tile")
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

function extractFromDashboardTiles(texts: string[]): { clockInTime: string | null; clockOutTime: string | null; seen: boolean } {
  const safeTexts = texts.map(normalizeText).filter(Boolean);
  const combined = safeTexts.join(" ");
  const clockInTime = firstTimeAfterLabel(safeTexts, [/masa hadir/i, /klik masuk/i, /\ba50\b/i], [/masa keluar/i, /klik keluar/i, /\ba51\b/i]);
  const clockOutTime = firstTimeAfterLabel(safeTexts, [/masa keluar/i, /klik keluar/i, /\ba51\b/i], [/masa hadir/i, /klik masuk/i, /\ba50\b/i]);
  return {
    clockInTime,
    clockOutTime,
    seen: /masa hadir|klik masuk|a50|masa keluar|klik keluar|a51/i.test(combined)
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

  const hour = match[1].padStart(2, "0");
  return `${hour}:${match[2]}`;
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
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .replace(/\blink=[^\s&]+/gi, "[redacted-link]")
    .replace(/\bmagic=[^\s&]+/gi, "[redacted-magic]")
    .replace(/\b4Tredir=[^\s&]+/gi, "[redacted-redirect]")
    .replace(/\b(cookie|password|credential|token|bearer)\b\s*[:=]?\s*[^\s]*/gi, "$1 [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  return sanitized || null;
}
