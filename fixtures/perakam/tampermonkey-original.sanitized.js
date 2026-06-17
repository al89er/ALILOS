// Sanitized legacy reference only.
// Runtime app logic must not import or execute this file.
// Secrets were removed and replaced with placeholders.
// Behavior should be ported intentionally through TypeScript code, not copied blindly.

const LEGACY_PERAKAM_REFERENCE = {
  dashboardUrl: "https://perakamwaktu3.upm.edu.my/",
  telegram: {
    botToken: "REDACTED_TELEGRAM_BOT_TOKEN",
    chatId: "REDACTED_TELEGRAM_CHAT_ID",
    commands: [
      "/status",
      "/skip",
      "/unskip",
      "/skipnext",
      "/unskipnext",
      "/skips",
      "/help",
      "/refresh",
      "/hardreset"
    ]
  },
  targets: {
    clockIn: "a50",
    clockOut: "a51",
    legacyTestA: "a56",
    legacyTestB: "a57"
  },
  scheduleWindows: {
    morning: {
      start: "07:45",
      end: "07:50"
    },
    evening: {
      start: "17:05",
      end: "17:10"
    }
  }
};

function legacyRandomTimeWithinWindow(window) {
  return `randomized between ${window.start} and ${window.end}`;
}

function legacySkipState() {
  return {
    skippedDates: [],
    skipToday: "mark current date as skipped",
    unskipToday: "remove current date from skipped list",
    skipNext: "mark next work date as skipped",
    unskipNext: "remove next work date from skipped list"
  };
}

function legacyKeepAliveBehavior() {
  return {
    purpose: "periodically keep the dashboard/session observable",
    avoidsRealAttendanceSubmission: true,
    notes: "Port only as explicit, reviewed TypeScript behavior."
  };
}

function legacyRefreshBehavior(command) {
  if (command === "/hardreset") {
    return "clear transient state and reload dashboard";
  }

  return "refresh dashboard/status state";
}

function findVisibleLegacyTarget(documentLike, targetId) {
  const candidates = Array.from(documentLike.querySelectorAll(`#${targetId}`));
  return candidates.find((candidate) => {
    const text = candidate.textContent || "";
    const hiddenBySidebar = Boolean(candidate.closest(".left_col, #sidebar-menu, .nav.child_menu"));
    const visibleDashboardTarget = Boolean(candidate.closest(".right_col, .top_tiles, .tile-stats"));
    return !hiddenBySidebar && visibleDashboardTarget && text.trim().length > 0;
  }) || null;
}

function legacyReferenceSummary() {
  return {
    dashboardUrl: LEGACY_PERAKAM_REFERENCE.dashboardUrl,
    targetIds: Object.values(LEGACY_PERAKAM_REFERENCE.targets),
    morningWindow: legacyRandomTimeWithinWindow(LEGACY_PERAKAM_REFERENCE.scheduleWindows.morning),
    eveningWindow: legacyRandomTimeWithinWindow(LEGACY_PERAKAM_REFERENCE.scheduleWindows.evening),
    skipUnskip: legacySkipState(),
    keepAlive: legacyKeepAliveBehavior(),
    refresh: legacyRefreshBehavior("/refresh"),
    hardreset: legacyRefreshBehavior("/hardreset")
  };
}
