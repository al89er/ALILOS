import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type {
  AttendanceActionType,
  AttendanceControlAvailability,
  AttendanceControlSnapshot,
  AttendanceVerificationResult,
  AttendanceVerificationStatus,
  BrowserControllerState,
  BrowserStatusSnapshot,
  PerakamAutoLoginAttemptResult,
  PerakamPageStatus,
  PerakamObservedValuesSnapshot,
  PerakamStatusSnapshot,
  TestClickTargetId,
  TestClickTargetCandidateDiagnostic,
  TestClickTargetDiagnostics,
  TestClickTargetSnapshot
} from "../shared/types";
import type { AppLogger } from "../main/logger";
import {
  type DashboardTileObservation,
  emptyPerakamObservedValues,
  extractPerakamObservedValues,
  observedPageStateFromPerakamStatus
} from "./perakam-observed-values";

const DEFAULT_PERAKAM_DASHBOARD_URL = "https://perakamwaktu3.upm.edu.my/";
const LEGACY_PERAKAM_DASHBOARD_URL = "https://perakamwaktu.upm.edu.my/";
const PERAKAM_NAVIGATION_TIMEOUT_MS = 30000;
const MAX_BODY_TEXT_FOR_STATUS = 12000;

interface AttendanceControlDetection {
  clockInAvailable: AttendanceControlAvailability;
  clockOutAvailable: AttendanceControlAvailability;
  clockInReason: string;
  clockOutReason: string;
  lastButtonCheckAt: string | null;
}

interface PerakamPageMarkers {
  title: string;
  textSnippet: string;
  hasLoginForm: boolean;
  hasUsernameInput: boolean;
  hasPasswordInput: boolean;
  hasLoginButton: boolean;
  hasLoginDoReference: boolean;
  hasInfoPenggunaTitle: boolean;
  hasNoUserInformationText: boolean;
  hasGoToLoginText: boolean;
  hasDashboardAncestry: boolean;
  evidenceSnippets: string[];
}

interface PerakamPageClassification {
  status: PerakamPageStatus;
  reason: string;
  evidenceSnippets: string[];
}

interface ControlProbeResult {
  availability: AttendanceControlAvailability;
  reason: string;
  visible?: boolean;
  enabled?: boolean;
  actionable?: boolean;
  hiddenSidebar?: boolean;
  dashboardCandidate?: boolean;
  descendantVisible?: boolean;
}

interface TestClickBrowserExecutionResult {
  targetId: TestClickTargetId;
  beforeUrl: string | null;
  afterUrl: string | null;
  targetAvailability: TestClickTargetSnapshot;
}

interface AttendanceBrowserExecutionResult {
  action: AttendanceActionType;
  mappedTargetId: "a50" | "a51";
  beforeUrl: string | null;
  afterUrl: string | null;
  controlAvailability: AttendanceControlSnapshot;
}

interface AttendanceBrowserVerificationResult extends AttendanceVerificationResult {}

export class BrowserController {
  private context: BrowserContext | null = null;
  private perakamPage: Page | null = null;
  private state: BrowserControllerState = "stopped";
  private lastStartedAt: string | null = null;
  private lastStoppedAt: string | null = null;
  private lastError: string | null = null;
  private lastLoggedPerakamStatus: PerakamPageStatus | null = null;
  private lastLoggedAttendanceControlsSignature: string | null = null;
  private lastLoggedObservedValuesSignature: string | null = null;
  private observedPerakamValues: PerakamObservedValuesSnapshot = emptyPerakamObservedValues();
  private perakamStatus: PerakamStatusSnapshot = {
    status: "not-opened",
    dashboardUrl: "",
    legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
    currentUrl: null,
    pageTitle: null,
    pageState: "not-opened",
    statusReason: "Perakam page is not open.",
    evidenceSnippets: [],
    lastNavigationAt: null,
    lastCheckedAt: null,
    ...unknownAttendanceControls("Not checked."),
    observedValues: emptyPerakamObservedValues(),
    lastError: null
  };
  private startPromise: Promise<BrowserStatusSnapshot> | null = null;
  private stopPromise: Promise<BrowserStatusSnapshot> | null = null;
  private readonly profilePath: string;

  constructor(
    userDataPath: string,
    private readonly logger: AppLogger,
    private readonly onStatusChanged: () => void = () => {}
  ) {
    this.profilePath = path.join(userDataPath, "playwright-profile");
  }

  status(): BrowserStatusSnapshot {
    return {
      state: this.state,
      profilePath: this.profilePath,
      lastStartedAt: this.lastStartedAt,
      lastStoppedAt: this.lastStoppedAt,
      lastError: this.lastError
    };
  }

  getPerakamStatus(dashboardUrl: string): PerakamStatusSnapshot {
    this.perakamStatus.dashboardUrl = sanitizeUrlForDisplay(normalizeUrl(dashboardUrl));
    return { ...this.perakamStatus, observedValues: this.getObservedPerakamValues() };
  }

  getObservedPerakamValues(): PerakamObservedValuesSnapshot {
    return { ...this.observedPerakamValues };
  }

  async refreshObservedPerakamValues(dashboardUrl: string): Promise<PerakamObservedValuesSnapshot> {
    this.perakamStatus.dashboardUrl = sanitizeUrlForDisplay(normalizeUrl(dashboardUrl));
    const observedAt = new Date().toISOString();
    const pageStatus = this.perakamStatus.status;
    const page = this.perakamPage && !this.perakamPage.isClosed() ? this.perakamPage : null;

    if (!page) {
      return this.setObservedPerakamValues({
        ...emptyPerakamObservedValues("unreachable", "Perakam page is not open; observed attendance times were not read."),
        observedAt
      });
    }

    if (observedPageStateFromPerakamStatus(pageStatus) !== "logged-in-dashboard") {
      return this.setObservedPerakamValues(extractPerakamObservedValues({
        pageStatus,
        dashboardTileTexts: [],
        observedAt,
        todayDateKey: localDateKey(new Date())
      }));
    }

    try {
      const dashboardTiles = await page.evaluate(() => {
        const isVisible = (element: Element): boolean => {
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const cleanText = (value: string | null | undefined): string => (value ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
        const selectors: Array<{ action: "clock-in" | "clock-out"; selector: string; valueSelector: "#wm" | "#wk" }> = [
          { action: "clock-in", selector: ".right_col .top_tiles a#a50 .tile-stats", valueSelector: "#wm" },
          { action: "clock-out", selector: ".right_col .top_tiles a#a51 .tile-stats", valueSelector: "#wk" },
          { action: "clock-in", selector: ".top_tiles a#a50 .tile-stats", valueSelector: "#wm" },
          { action: "clock-out", selector: ".top_tiles a#a51 .tile-stats", valueSelector: "#wk" }
        ];
        const seen = new Set<Element>();
        const tiles: DashboardTileObservation[] = [];
        for (const item of selectors) {
          for (const element of Array.from(document.querySelectorAll(item.selector))) {
            if (seen.has(element)) {
              continue;
            }
            seen.add(element);
            const inSidebar = Boolean(element.closest("ul.nav.child_menu"));
            const visible = isVisible(element);
            if (!visible || inSidebar) {
              continue;
            }
            tiles.push({
              action: item.action,
              text: cleanText(element.textContent),
              valueText: cleanText(element.querySelector(item.valueSelector)?.textContent),
              dateText: cleanText(element.querySelector("#twm")?.textContent),
              valueSelector: item.valueSelector,
              visible,
              inSidebar
            });
          }
        }
        return tiles.slice(0, 4);
      }) as DashboardTileObservation[];

      return this.setObservedPerakamValues(extractPerakamObservedValues({
        pageStatus,
        dashboardTiles,
        observedAt,
        todayDateKey: localDateKey(new Date())
      }));
    } catch (error) {
      this.logger.warn(`Perakam observed values check failed: ${sanitizeError(error)}`);
      return this.setObservedPerakamValues({
        ...emptyPerakamObservedValues("unknown", "Perakam observed values check failed without changing page state."),
        observedAt
      });
    }
  }

  async start(): Promise<BrowserStatusSnapshot> {
    if (this.stopPromise) {
      await this.stopPromise;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    if (this.state === "starting") {
      return this.status();
    }

    if (this.context) {
      this.state = "running";
      return this.status();
    }

    this.logger.info("Browser start requested.");
    this.startPromise = this.startBrowser();
    return this.startPromise.finally(() => {
      this.startPromise = null;
    });
  }

  async openPerakam(dashboardUrl: string): Promise<PerakamStatusSnapshot> {
    const targetUrl = normalizeUrl(dashboardUrl);
    const displayUrl = sanitizeUrlForDisplay(targetUrl);
    this.perakamStatus.dashboardUrl = displayUrl;
    this.logger.info("Perakam open requested.");

    try {
      await this.start();

      if (!this.context) {
        throw new Error(this.lastError ?? "Browser is not available.");
      }

      const page = await this.getOrCreatePerakamPage();
      this.setPerakamSnapshot({
        status: "loading",
        dashboardUrl: displayUrl,
        legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
        currentUrl: sanitizeUrlForDisplay(page.url()),
        pageTitle: null,
        pageState: "loading",
        statusReason: "Perakam navigation is loading.",
        evidenceSnippets: [],
        lastNavigationAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        ...unknownAttendanceControls("Navigation started; button availability is not current.", new Date().toISOString()),
        lastError: null
      });

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: PERAKAM_NAVIGATION_TIMEOUT_MS
      });

      await this.refreshPerakamStatus(targetUrl);
    } catch (error) {
      const message = sanitizeError(error);
      const checkedAt = new Date().toISOString();
      this.setPerakamSnapshot({
        status: "error",
        dashboardUrl: displayUrl,
        legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
        currentUrl: this.currentPerakamUrl(),
        pageTitle: this.perakamStatus.pageTitle,
        pageState: "error",
        statusReason: message,
        evidenceSnippets: [],
        lastNavigationAt: this.perakamStatus.lastNavigationAt,
        lastCheckedAt: checkedAt,
        ...unknownAttendanceControls("Button check unavailable because navigation failed.", checkedAt),
        lastError: message
      });
    }

    this.onStatusChanged();
    return this.getPerakamStatus(targetUrl);
  }

  async refreshPerakamStatus(dashboardUrl: string): Promise<PerakamStatusSnapshot> {
    const targetUrl = normalizeUrl(dashboardUrl);
    const displayUrl = sanitizeUrlForDisplay(targetUrl);
    this.perakamStatus.dashboardUrl = displayUrl;

    if (!this.perakamPage || this.perakamPage.isClosed()) {
      this.setPerakamSnapshot({
        status: "not-opened",
        dashboardUrl: displayUrl,
        legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
        currentUrl: null,
        pageTitle: null,
        pageState: "not-opened",
        statusReason: "Perakam page is not open.",
        evidenceSnippets: [],
        lastNavigationAt: this.perakamStatus.lastNavigationAt,
        lastCheckedAt: new Date().toISOString(),
        ...unknownAttendanceControls("Perakam page is not open."),
        lastError: null
      });
      this.onStatusChanged();
      return this.getPerakamStatus(targetUrl);
    }

    try {
      const page = this.perakamPage;
      const [title, readyState, bodyText, markers] = await Promise.all([
        page.title().catch(() => ""),
        page.evaluate(() => document.readyState).catch(() => "unknown"),
        page.evaluate((maxLength) => document.body?.innerText.slice(0, maxLength) ?? "", MAX_BODY_TEXT_FOR_STATUS).catch(() => ""),
        page.evaluate(readPerakamPageMarkersFromDocument).catch(() => null)
      ]);
      const buttonCheckAt = new Date().toISOString();
      const firstAttendanceControls = readyState === "loading"
        ? unknownAttendanceControls("Page is still loading.", buttonCheckAt)
        : await detectAttendanceControls(page, buttonCheckAt);
      const attendanceControls = readyState === "loading"
        ? firstAttendanceControls
        : await retryAttendanceControlsIfDashboardMarkersExist(page, markers, firstAttendanceControls);
      const classification = classifyPerakamPage(
        sanitizeUrlForDisplay(page.url()),
        title,
        bodyText,
        readyState,
        markers,
        attendanceControls,
        null
      );

      this.setPerakamSnapshot({
        status: classification.status,
        dashboardUrl: displayUrl,
        legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
        currentUrl: sanitizeUrlForDisplay(page.url()),
        pageTitle: title || null,
        pageState: classification.status,
        statusReason: classification.reason,
        evidenceSnippets: classification.evidenceSnippets,
        lastNavigationAt: this.perakamStatus.lastNavigationAt,
        lastCheckedAt: buttonCheckAt,
        ...attendanceControls,
        lastError: null
      });
    } catch (error) {
      const message = sanitizeError(error);
      const checkedAt = new Date().toISOString();
      this.setPerakamSnapshot({
        status: "error",
        dashboardUrl: displayUrl,
        legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
        currentUrl: this.currentPerakamUrl(),
        pageTitle: this.perakamStatus.pageTitle,
        pageState: "error",
        statusReason: message,
        evidenceSnippets: [],
        lastNavigationAt: this.perakamStatus.lastNavigationAt,
        lastCheckedAt: checkedAt,
        ...unknownAttendanceControls("Button check unavailable because status detection failed.", checkedAt),
        lastError: message
      });
    }

    this.onStatusChanged();
    return this.getPerakamStatus(targetUrl);
  }

  async attemptPerakamAutoLogin(input: {
    dashboardUrl: string;
    username: string;
    password: string;
    force?: boolean;
  }): Promise<PerakamAutoLoginAttemptResult> {
    const attemptedAt = new Date().toISOString();
    const targetUrl = normalizeUrl(input.dashboardUrl);
    await this.refreshPerakamStatus(targetUrl);

    if (!this.perakamPage || this.perakamPage.isClosed()) {
      return {
        ok: false,
        status: "unavailable",
        reason: "Perakam page is not open.",
        attemptedAt,
        pageState: "not-opened"
      };
    }

    let currentState = this.perakamStatus.status as PerakamPageStatus;
    if (currentState === "stale-session") {
      const currentUrl = this.perakamPage.url();
      let loginUrl: string;
      try {
        loginUrl = new URL("login.do", targetUrl).toString();
      } catch {
        return {
          ok: false,
          status: "unavailable",
          reason: "Session stale: configured Perakam login URL is invalid.",
          attemptedAt,
          pageState: currentState
        };
      }

      if (!isSameHost(currentUrl, targetUrl) || !isSameHost(loginUrl, targetUrl)) {
        return {
          ok: false,
          status: "unavailable",
          reason: "Session stale: auto-login recovery blocked because the page is not on the configured Perakam host.",
          attemptedAt,
          pageState: currentState
        };
      }

      try {
        this.logger.info("Session stale: returning to Perakam login page.");
        await this.perakamPage.goto(loginUrl, {
          waitUntil: "domcontentloaded",
          timeout: PERAKAM_NAVIGATION_TIMEOUT_MS
        });
        await this.refreshPerakamStatus(targetUrl);
        currentState = this.perakamStatus.status as PerakamPageStatus;
      } catch (error) {
        const reason = sanitizeError(error);
        await this.refreshPerakamStatus(targetUrl).catch(() => undefined);
        this.logger.warn(`Perakam stale-session recovery navigation failed: ${reason}`);
        return {
          ok: false,
          status: "failed",
          reason: "Perakam auto-login failed after stale-session recovery. Please check credentials or log in manually.",
          attemptedAt,
          pageState: this.perakamStatus.status
        };
      }

      if (currentState !== "login-required") {
        const reason = `Perakam auto-login failed after stale-session recovery. Resulting state: ${currentState}.`;
        this.logger.warn(reason);
        return {
          ok: false,
          status: "failed",
          reason,
          attemptedAt,
          pageState: currentState
        };
      }

      this.logger.info("Perakam login page detected. Auto-login in progress.");
    }

    if (currentState !== "login-required") {
      return {
        ok: false,
        status: "unavailable",
        reason: `Auto-login requires a recognized Perakam login page. Current state: ${currentState}.`,
        attemptedAt,
        pageState: currentState
      };
    }

    const loginPageUrl = this.perakamPage.url();
    if (!isSameHost(loginPageUrl, targetUrl)) {
      return {
        ok: false,
        status: "unavailable",
        reason: "Auto-login blocked because the current page is not on the configured Perakam host.",
        attemptedAt,
        pageState: currentState
      };
    }

    this.logger.info("Perakam auto-login attempted.");

    for (const frame of this.perakamPage.frames()) {
      const recognized = await frame.evaluate(isRecognizedPerakamLoginForm).catch(() => false);
      if (!recognized) {
        continue;
      }

      try {
        await frame.locator("input#username, input[name='username']").first().fill(input.username, { timeout: 5000 });
        await frame.locator("input#password, input[name='password'], input[type='password']").first().fill(input.password, { timeout: 5000 });
        const submit = frame.locator("#frmchklogin button, #frmchklogin input[type='submit'], #frmchklogin input[type='button']").first();
        const navigationWait = this.perakamPage.waitForLoadState("domcontentloaded", { timeout: 12000 }).catch(() => undefined);
        await submit.click({ timeout: 5000 });
        await navigationWait;
        const postLoginStatus = await this.waitForPostLoginStatus(targetUrl);

        if (isLoggedInStatus(postLoginStatus)) {
          this.logger.info("Perakam auto-login succeeded.");
          return {
            ok: true,
            status: "success",
            reason: "Perakam auto-login succeeded. Dashboard detected.",
            attemptedAt,
            pageState: postLoginStatus
          };
        }

        const reason = loginFailureReason(postLoginStatus);
        this.logger.warn(`Perakam auto-login failed: ${reason}`);
        return {
          ok: false,
          status: "failed",
          reason,
          attemptedAt,
          pageState: postLoginStatus
        };
      } catch (error) {
        const reason = sanitizeError(error);
        await this.refreshPerakamStatus(targetUrl).catch(() => undefined);
        this.logger.warn(`Perakam auto-login failed: ${reason}`);
        return {
          ok: false,
          status: "failed",
          reason,
          attemptedAt,
          pageState: this.perakamStatus.status
        };
      }
    }

    return {
      ok: false,
      status: "unavailable",
      reason: "Recognized Perakam login form was not found.",
      attemptedAt,
      pageState: this.perakamStatus.status
    };
  }

  private async waitForPostLoginStatus(targetUrl: string): Promise<PerakamPageStatus> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await this.refreshPerakamStatus(targetUrl);
      const status = this.perakamStatus.status as PerakamPageStatus;

      if (isLoggedInStatus(status) || status === "login-required" || status === "stale-session" || status === "error") {
        return status;
      }

      if (attempt < 5) {
        await delay(1000);
      }
    }

    return this.perakamStatus.status as PerakamPageStatus;
  }

  async detectTestClickTarget(targetId: TestClickTargetId): Promise<TestClickTargetSnapshot> {
    assertTestClickTarget(targetId);
    const checkedAt = new Date().toISOString();
    const diagnostics = await this.inspectTestClickTargets();
    const candidates = diagnostics.targets[targetId];

    if (candidates.length === 0) {
      return {
        targetId,
        availability: "unknown",
        reason: this.perakamPage && !this.perakamPage.isClosed()
          ? `${targetId} test click target was not found.`
          : "Perakam page is not open.",
        checkedAt
      };
    }

    const available = candidates.filter((candidate) => candidate.detectorDecision === "available");
    const unavailable = candidates.filter((candidate) => candidate.detectorDecision === "unavailable");
    const visible = candidates.filter((candidate) => candidate.ownVisible || candidate.meaningfulDescendantVisible);
    const enabled = candidates.filter((candidate) => !candidate.disabled);
    const hiddenSidebar = candidates.filter((candidate) => candidate.insideChildMenu || candidate.insideSidebarMenu || candidate.insideLeftCol);

    if (available.length > 0) {
      return {
        targetId,
        availability: "available",
        reason: testClickCandidateSummary(candidates.length, visible.length, enabled.length, available.length, "visible test click target found"),
        checkedAt
      };
    }

    if (unavailable.length === candidates.length) {
      const detail = hiddenSidebar.length === candidates.length
        ? "all candidates are hidden in the sidebar; manually expand the relevant Perakam menu, then check readiness again"
        : "all test click targets hidden or disabled";

      return {
        targetId,
        availability: "unavailable",
        reason: testClickCandidateSummary(candidates.length, visible.length, enabled.length, available.length, detail),
        checkedAt
      };
    }

    return {
      targetId,
      availability: "unknown",
      reason: testClickCandidateSummary(candidates.length, visible.length, enabled.length, available.length, "test click target availability is uncertain"),
      checkedAt
    };
  }

  async inspectTestClickTargets(): Promise<TestClickTargetDiagnostics> {
    const checkedAt = new Date().toISOString();

    if (!this.perakamPage || this.perakamPage.isClosed()) {
      return {
        checkedAt,
        targets: {
          a56: [],
          a57: []
        }
      };
    }

    const frameResults = await Promise.all(
      this.perakamPage.frames().map(async (frame) => {
        try {
          return await frame.evaluate(readTestClickTargetDiagnosticsFromDocument, checkedAt);
        } catch {
          return null;
        }
      })
    );
    const results = frameResults.filter((result): result is TestClickTargetDiagnostics => result !== null);

    return {
      checkedAt,
      targets: {
        a56: results.flatMap((result) => result.targets.a56),
        a57: results.flatMap((result) => result.targets.a57)
      }
    };
  }

  async clickVisibleTestTarget(targetId: TestClickTargetId): Promise<TestClickBrowserExecutionResult> {
    assertTestClickTarget(targetId);

    if (!this.perakamPage || this.perakamPage.isClosed()) {
      throw new Error("Perakam page is not open.");
    }

    const page = this.perakamPage;
    const beforeUrl = sanitizeUrlForDisplay(page.url()) || null;
    const checkedAt = new Date().toISOString();

    for (const frame of page.frames()) {
      const result = await frame.evaluate(clickTestClickTargetInDocument, { targetId, checkedAt }).catch(() => null);
      if (result?.clicked) {
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
        await this.refreshPerakamStatus(this.perakamStatus.dashboardUrl);
        return {
          targetId,
          beforeUrl,
          afterUrl: sanitizeUrlForDisplay(page.url()) || null,
          targetAvailability: result.target
        };
      }
    }

    throw new Error(`${targetId} test click target is not visibly available.`);
  }

  async clickVisibleAttendanceControl(action: AttendanceActionType): Promise<AttendanceBrowserExecutionResult> {
    assertAttendanceAction(action);

    if (!this.perakamPage || this.perakamPage.isClosed()) {
      throw new Error("Perakam page is not open.");
    }

    const page = this.perakamPage;
    const mappedTargetId = attendanceTargetId(action);
    const beforeUrl = sanitizeUrlForDisplay(page.url()) || null;
    const checkedAt = new Date().toISOString();

    for (const frame of page.frames()) {
      const result = await frame.evaluate(clickAttendanceControlInDocument, {
        action,
        mappedTargetId,
        checkedAt
      }).catch(() => null);

      if (result?.clicked) {
        await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
        await this.refreshPerakamStatus(this.perakamStatus.dashboardUrl);
        return {
          action,
          mappedTargetId,
          beforeUrl,
          afterUrl: sanitizeUrlForDisplay(page.url()) || null,
          controlAvailability: result.controlAvailability
        };
      }
    }

    throw new Error(`${mappedTargetId} target control is not visibly available.`);
  }

  async verifyAttendanceAfterClick(
    action: AttendanceActionType,
    dateKey: string,
    localClickResult: AttendanceVerificationResult["localClickResult"]
  ): Promise<AttendanceBrowserVerificationResult> {
    assertAttendanceAction(action);
    const checkedAt = new Date().toISOString();

    if (!this.perakamPage || this.perakamPage.isClosed()) {
      return {
        action,
        dateKey,
        localClickResult,
        status: "verification-unknown",
        reason: "Perakam page is not open for read-only verification.",
        sanitizedUrlAfterClick: null,
        evidenceSnippets: [],
        checkedAt
      };
    }

    const page = this.perakamPage;
    const sanitizedUrlAfterClick = sanitizeUrlForDisplay(page.url()) || null;
    const [title, readyState, bodyText, markers] = await Promise.all([
      page.title().catch(() => ""),
      page.evaluate(() => document.readyState).catch(() => "unknown"),
      page.evaluate((maxLength) => document.body?.innerText.slice(0, maxLength) ?? "", MAX_BODY_TEXT_FOR_STATUS).catch(() => ""),
      page.evaluate(readPerakamPageMarkersFromDocument).catch(() => null)
    ]);
    const controls = await detectAttendanceControls(page, checkedAt).catch(() => unknownAttendanceControls("Unable to inspect target controls during verification.", checkedAt));
    const classification = classifyPerakamPage(
      sanitizedUrlAfterClick ?? "",
      title,
      bodyText,
      readyState,
      markers,
      controls,
      null
    );
    const frameResults = await Promise.all(
      page.frames().map(async (frame) => {
        try {
          return await frame.evaluate(readAttendanceVerificationFromDocument, { action });
        } catch {
          return null;
        }
      })
    );
    const evidence = frameResults
      .filter((result): result is { status: AttendanceVerificationStatus; reason: string; snippets: string[] } => result !== null)
      .flatMap((result) => result.snippets)
      .slice(0, 5);
    const hasSuccess = frameResults.some((result) => result?.status === "verified-success");
    const hasFailure = frameResults.some((result) => result?.status === "verification-failed");
    const hasUnknown = frameResults.some((result) => result?.status === "verification-unknown");
    const titleSnippet = boundedSnippet(title);
    const evidenceSnippets = safeEvidence([
      titleSnippet ? `Title: ${titleSnippet}` : "",
      classification.reason,
      ...classification.evidenceSnippets,
      ...evidence
    ]);

    if (classification.status === "login-required") {
      return {
        action,
        dateKey,
        localClickResult,
        status: "verification-unknown",
        reason: "Login required after click. Local click succeeded, but server-side acceptance remains unconfirmed.",
        sanitizedUrlAfterClick,
        evidenceSnippets,
        checkedAt
      };
    }

    if (classification.status === "stale-session") {
      return {
        action,
        dateKey,
        localClickResult,
        status: "verification-unknown",
        reason: "Session stale after click. Perakam showed a no-user-info page, so server-side acceptance remains unconfirmed.",
        sanitizedUrlAfterClick,
        evidenceSnippets,
        checkedAt
      };
    }

    if (hasSuccess) {
      return {
        action,
        dateKey,
        localClickResult,
        status: "verified-success",
        reason: classification.status === "dashboard"
          ? "Dashboard detected after click. Read-only page evidence suggests Perakam accepted the configured action."
          : "Read-only page evidence suggests Perakam accepted the configured action.",
        sanitizedUrlAfterClick,
        evidenceSnippets,
        checkedAt
      };
    }

    if (hasFailure) {
      return {
        action,
        dateKey,
        localClickResult,
        status: "verification-failed",
        reason: "Read-only page evidence shows a visible error or rejection after the click.",
        sanitizedUrlAfterClick,
        evidenceSnippets,
        checkedAt
      };
    }

    return {
      action,
      dateKey,
      localClickResult,
      status: hasUnknown || evidenceSnippets.length > 0 ? "verification-unknown" : "verification-unknown",
      reason: `${classification.reason} Local click succeeded, but server-side confirmation remains heuristic/unknown. Please visually confirm in the Perakam browser.`,
      sanitizedUrlAfterClick,
      evidenceSnippets,
      checkedAt
    };
  }

  async stop(): Promise<BrowserStatusSnapshot> {
    if (this.startPromise) {
      await this.startPromise;
    }

    if (this.stopPromise) {
      return this.stopPromise;
    }

    if (this.state === "stopping") {
      return this.status();
    }

    if (!this.context) {
      this.state = "stopped";
      return this.status();
    }

    this.logger.info("Browser stop requested.");
    this.stopPromise = this.stopBrowser();
    return this.stopPromise.finally(() => {
      this.stopPromise = null;
    });
  }

  private async startBrowser(): Promise<BrowserStatusSnapshot> {
    this.state = "starting";
    this.lastError = null;
    this.onStatusChanged();

    try {
      this.context = await chromium.launchPersistentContext(this.profilePath, {
        headless: false
      });
      this.context.on("close", () => {
        this.handleContextClosed();
      });
      this.state = "running";
      this.lastStartedAt = new Date().toISOString();
      this.logger.info("Browser started.");
    } catch (error) {
      this.context = null;
      this.state = "error";
      this.lastError = sanitizeError(error);
      this.logger.error(`Browser start error: ${this.lastError}`);
    }

    this.onStatusChanged();
    return this.status();
  }

  private async stopBrowser(): Promise<BrowserStatusSnapshot> {
    this.state = "stopping";
    this.lastError = null;
    this.onStatusChanged();

    try {
      const context = this.context;
      await context?.close();
      this.context = null;
      this.perakamPage = null;
      this.resetPerakamStatus();
      this.state = "stopped";
      this.lastStoppedAt = new Date().toISOString();
      this.logger.info("Browser stopped.");
    } catch (error) {
      this.state = "error";
      this.lastError = sanitizeError(error);
      this.logger.error(`Browser stop error: ${this.lastError}`);
    }

    this.onStatusChanged();
    return this.status();
  }

  private handleContextClosed(): void {
    if (!this.context) {
      return;
    }

    const wasStopping = this.state === "stopping";
    this.context = null;
    this.perakamPage = null;
    this.resetPerakamStatus();
    this.state = "stopped";
    this.lastStoppedAt = new Date().toISOString();

    if (!this.stopPromise && !wasStopping) {
      this.logger.info("Browser closed.");
    }

    this.onStatusChanged();
  }

  private async getOrCreatePerakamPage(): Promise<Page> {
    if (!this.context) {
      throw new Error("Browser is not running.");
    }

    if (this.perakamPage && !this.perakamPage.isClosed()) {
      return this.perakamPage;
    }

    this.perakamPage = this.context.pages().find((page) => !page.isClosed()) ?? await this.context.newPage();
    this.attachPerakamPageEvents(this.perakamPage);
    return this.perakamPage;
  }

  private attachPerakamPageEvents(page: Page): void {
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        this.perakamStatus.lastNavigationAt = new Date().toISOString();
        this.perakamStatus.currentUrl = sanitizeUrlForDisplay(page.url());
        void this.refreshPerakamStatus(this.perakamStatus.dashboardUrl);
      }
    });

    page.on("load", () => {
      void this.refreshPerakamStatus(this.perakamStatus.dashboardUrl);
    });

    page.on("close", () => {
      if (this.perakamPage === page) {
        this.perakamPage = null;
        this.setPerakamSnapshot({
          status: "not-opened",
          dashboardUrl: this.perakamStatus.dashboardUrl,
          legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
          currentUrl: null,
          pageTitle: null,
          pageState: "not-opened",
          statusReason: "Perakam page is not open.",
          evidenceSnippets: [],
          lastNavigationAt: this.perakamStatus.lastNavigationAt,
          lastCheckedAt: new Date().toISOString(),
          ...unknownAttendanceControls("Perakam page is not open."),
          lastError: null
        });
        this.onStatusChanged();
      }
    });
  }

  private resetPerakamStatus(): void {
    this.setPerakamSnapshot({
      status: "not-opened",
      dashboardUrl: this.perakamStatus.dashboardUrl,
      legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
      currentUrl: null,
      pageTitle: null,
      pageState: "not-opened",
      statusReason: "Perakam page is not open.",
      evidenceSnippets: [],
      lastNavigationAt: this.perakamStatus.lastNavigationAt,
      lastCheckedAt: new Date().toISOString(),
      ...unknownAttendanceControls("Perakam page is not open."),
      lastError: null
    });
  }

  private currentPerakamUrl(): string | null {
    return this.perakamPage && !this.perakamPage.isClosed() ? sanitizeUrlForDisplay(this.perakamPage.url()) || null : null;
  }

  private setPerakamSnapshot(snapshot: Omit<PerakamStatusSnapshot, "observedValues"> & { observedValues?: PerakamObservedValuesSnapshot }): void {
    const previousStatus = this.perakamStatus.status;
    const previousControlsSignature = attendanceControlsSignature(this.perakamStatus);
    this.perakamStatus = {
      ...snapshot,
      observedValues: snapshot.observedValues ?? this.getObservedPerakamValues()
    };

    if (this.perakamStatus.status !== previousStatus || this.perakamStatus.status !== this.lastLoggedPerakamStatus) {
      this.logPerakamStatus(this.perakamStatus);
      this.lastLoggedPerakamStatus = this.perakamStatus.status;
    }

    const nextControlsSignature = attendanceControlsSignature(this.perakamStatus);
    if (
      this.perakamStatus.lastButtonCheckAt
      && nextControlsSignature !== previousControlsSignature
      && nextControlsSignature !== this.lastLoggedAttendanceControlsSignature
    ) {
      this.logger.info(
        `Perakam target controls: morning ${this.perakamStatus.clockInAvailable}; evening ${this.perakamStatus.clockOutAvailable}.`
      );
      this.lastLoggedAttendanceControlsSignature = nextControlsSignature;
    }
  }

  private setObservedPerakamValues(snapshot: PerakamObservedValuesSnapshot): PerakamObservedValuesSnapshot {
    this.observedPerakamValues = snapshot;
    this.perakamStatus = {
      ...this.perakamStatus,
      observedValues: snapshot
    };

    const signature = `${snapshot.pageState}:${snapshot.source}:${snapshot.observedDate ?? "--"}:${snapshot.clockInTime ?? "--"}:${snapshot.clockOutTime ?? "--"}`;
    if (signature !== this.lastLoggedObservedValuesSignature) {
      this.logger.info(
        `Perakam observed values: page=${snapshot.pageState}; source=${snapshot.source}; clock-in=${snapshot.clockInTime ? "present" : "missing"}; clock-out=${snapshot.clockOutTime ? "present" : "missing"}.`
      );
      this.lastLoggedObservedValuesSignature = signature;
    }

    this.onStatusChanged();
    return { ...snapshot };
  }

  private logPerakamStatus(snapshot: PerakamStatusSnapshot): void {
    switch (snapshot.status) {
      case "reachable":
        this.logger.info(`Perakam opened/reachable. ${snapshot.statusReason}`);
        break;
      case "dashboard":
        this.logger.info("Perakam status: dashboard detected.");
        break;
      case "login-required":
      case "likely-login-required":
        this.logger.info("Perakam status: login required.");
        break;
      case "stale-session":
        this.logger.warn("Perakam status: stale session/no-user-info page.");
        break;
      case "likely-logged-in":
        this.logger.info("Perakam status: likely logged in.");
        break;
      case "unknown":
        this.logger.warn(`Perakam status: unknown. ${snapshot.statusReason}`);
        break;
      case "error":
        this.logger.error(`Perakam navigation/status error: ${snapshot.lastError ?? "Unknown error."}`);
        break;
      case "loading":
      case "not-opened":
        break;
    }
  }
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown browser controller error.";
  return raw
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .replace(/\blink=[^\s&]+/gi, "[redacted-link]")
    .replace(/\bmagic=[^\s&]+/gi, "[redacted-magic]")
    .replace(/\b4Tredir=[^\s&]+/gi, "[redacted-redirect]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240) || "Unknown browser controller error.";
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed || DEFAULT_PERAKAM_DASHBOARD_URL;
}

function isSameHost(currentUrl: string, configuredUrl: string): boolean {
  try {
    return new URL(currentUrl).host === new URL(configuredUrl).host;
  } catch {
    return false;
  }
}

function sanitizeUrlForDisplay(url: string): string {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = parsed.search ? "?[redacted]" : "";
    parsed.hash = parsed.hash ? "#[redacted]" : "";
    return parsed.toString();
  } catch {
    return url.replace(/[?#].*$/, "?[redacted]");
  }
}

function boundedSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 180);
}

function classifyPerakamPage(
  sanitizedUrl: string,
  title: string,
  bodyText: string,
  readyState: string,
  markers: PerakamPageMarkers | null,
  controls: AttendanceControlDetection,
  lastError: string | null
): PerakamPageClassification {
  if (lastError) {
    return {
      status: "error",
      reason: lastError,
      evidenceSnippets: []
    };
  }

  if (!sanitizedUrl || sanitizedUrl === "about:blank") {
    return {
      status: "not-opened",
      reason: "Perakam page is not open.",
      evidenceSnippets: []
    };
  }

  if (readyState === "loading") {
    return {
      status: "loading",
      reason: "Perakam page is loading.",
      evidenceSnippets: []
    };
  }

  const combined = `${sanitizedUrl}\n${title}\n${bodyText}\n${markers?.textSnippet ?? ""}`.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const normalizedUrl = sanitizedUrl.toLowerCase();
  const isPerakamUrl = normalizedUrl.includes("perakamwaktu3.upm.edu.my") || normalizedUrl.includes("perakamwaktu.upm.edu.my");
  const isLoginDoUrl = isPerakamUrl && normalizedUrl.includes("login.do");
  const hasPageContent = title.trim().length > 0 || bodyText.trim().length > 0;
  const evidence = safeEvidence([
    title ? `Title: ${boundedSnippet(title)}` : "",
    ...(markers?.evidenceSnippets ?? [])
  ]);
  const loginSignals = [
    isLoginDoUrl,
    normalizedTitle.includes("login page"),
    hasAny(combined, ["e-perakam waktu online"]),
    Boolean(markers?.hasLoginForm),
    Boolean(markers?.hasUsernameInput),
    Boolean(markers?.hasPasswordInput),
    Boolean(markers?.hasLoginButton),
    hasAny(combined, ["log masuk!"])
  ].filter(Boolean).length;
  const staleSignals = [
    normalizedTitle.includes("info pengguna"),
    Boolean(markers?.hasInfoPenggunaTitle),
    Boolean(markers?.hasNoUserInformationText),
    Boolean(markers?.hasGoToLoginText),
    Boolean(markers?.hasLoginDoReference),
    hasAny(combined, ["no user informations", "sorry! we couldn't find this user's record", "go to login page"])
  ].filter(Boolean).length;
  const hasVisibleAttendanceControl = controls.clockInAvailable === "available" || controls.clockOutAvailable === "available";
  const dashboardSignals = [
    hasVisibleAttendanceControl,
    Boolean(markers?.hasDashboardAncestry),
    normalizedTitle.includes("salam sejahtera"),
    hasAny(combined, [
      "masa hadir",
      "masa keluar",
      "klik masuk",
      "klik keluar",
      "eperakam waktu online",
      "notis & kad perakam",
      "kad perakam",
      "senarai kehadiran",
      "kenyataan kehadiran"
    ])
  ].filter(Boolean).length;

  if (loginSignals >= 3) {
    return {
      status: "login-required",
      reason: "Login required: please log in manually in the browser.",
      evidenceSnippets: evidence
    };
  }

  if (staleSignals >= 2) {
    return {
      status: "stale-session",
      reason: "Session stale: Perakam showed a no-user-info page. Please return to login manually.",
      evidenceSnippets: evidence
    };
  }

  if (dashboardSignals >= 1 && hasVisibleAttendanceControl) {
    return {
      status: "dashboard",
      reason: "Dashboard detected.",
      evidenceSnippets: evidence
    };
  }

  if (dashboardSignals >= 1) {
    return {
      status: "likely-logged-in",
      reason: "Perakam dashboard markers detected, but target controls were not confirmed.",
      evidenceSnippets: evidence
    };
  }

  if (isPerakamUrl && hasPageContent) {
    return {
      status: "reachable",
      reason: "Perakam host is reachable, but dashboard controls were not confirmed.",
      evidenceSnippets: evidence
    };
  }

  return {
    status: "unknown",
    reason: "Perakam state unknown. Open or inspect the browser manually.",
    evidenceSnippets: evidence
  };
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function loginFailureReason(status: PerakamPageStatus): string {
  switch (status) {
    case "login-required":
    case "likely-login-required":
      return "login page still shown";
    case "stale-session":
      return "stale-session";
    case "dashboard":
      return "dashboard detected";
    case "error":
      return "Perakam status error after login attempt";
    default:
      return `Perakam state after login attempt: ${status}`;
  }
}

function isLoggedInStatus(status: PerakamPageStatus): boolean {
  return status === "dashboard" || status === "likely-logged-in";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function safeEvidence(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => boundedSnippet(value)).filter(Boolean))).slice(0, 6);
}

function readPerakamPageMarkersFromDocument(): PerakamPageMarkers {
  function localBoundedSnippet(value: string): string {
    return value.replace(/\s+/g, " ").trim().slice(0, 180);
  }

  function localSafeEvidence(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => localBoundedSnippet(value)).filter(Boolean))).slice(0, 6);
  }

  const title = document.title ?? "";
  const bodyText = localBoundedSnippet(document.body?.innerText || document.body?.textContent || "");
  const allText = `${title}\n${bodyText}`.toLowerCase();
  const loginButton = Array.from(document.querySelectorAll<HTMLElement>("button,input[type='button'],input[type='submit'],a"))
    .some((element) => localBoundedSnippet(element.innerText || element.textContent || (element as HTMLInputElement).value || "").toLowerCase().includes("log masuk"));
  const usernameInput = Boolean(document.querySelector("input[name='username'], input#username, input[name='userName'], input#userName"));
  const passwordInput = Boolean(document.querySelector("input[name='password'], input#password, input[type='password']"));
  const loginRefs = Array.from(document.querySelectorAll<HTMLAnchorElement | HTMLLinkElement | HTMLScriptElement>("a[href], link[href], script[src]"))
    .some((element) => {
      const value = "href" in element ? element.href : element.src;
      return value.toLowerCase().includes("login.do");
    });
  const evidenceSources = [
    title ? `Title: ${title}` : "",
    bodyText,
    document.querySelector("#frmchklogin") ? "form#frmchklogin present" : "",
    usernameInput ? "username input marker present" : "",
    passwordInput ? "password input marker present" : "",
    loginButton ? "login button marker present" : "",
    loginRefs ? "login.do reference present" : "",
    document.querySelector(".top_tiles, .right_col, .tile-stats") ? "dashboard ancestry marker present" : ""
  ];

  return {
    title,
    textSnippet: bodyText,
    hasLoginForm: Boolean(document.querySelector("#frmchklogin, form[name='frmchklogin']")),
    hasUsernameInput: usernameInput,
    hasPasswordInput: passwordInput,
    hasLoginButton: loginButton,
    hasLoginDoReference: loginRefs,
    hasInfoPenggunaTitle: title.toLowerCase().includes("info pengguna"),
    hasNoUserInformationText: allText.includes("no user informations") || allText.includes("sorry! we couldn't find this user's record"),
    hasGoToLoginText: allText.includes("go to login page"),
    hasDashboardAncestry: Boolean(document.querySelector(".top_tiles, .right_col, .tile-stats")),
    evidenceSnippets: localSafeEvidence(evidenceSources)
  };
}

function isRecognizedPerakamLoginForm(): boolean {
  const form = document.querySelector<HTMLFormElement>("#frmchklogin, form[name='frmchklogin']");
  const username = document.querySelector<HTMLInputElement>("input#username, input[name='username']");
  const password = document.querySelector<HTMLInputElement>("input#password, input[name='password'], input[type='password']");
  const submitCandidates = Array.from(document.querySelectorAll<HTMLElement>("#frmchklogin button, #frmchklogin input[type='submit'], #frmchklogin input[type='button'], button, input[type='submit'], input[type='button']"));
  const hasSubmit = submitCandidates.some((element) => {
    const value = element instanceof HTMLInputElement ? element.value : "";
    return `${element.innerText} ${element.textContent} ${value}`.toLowerCase().includes("log masuk");
  });
  const text = `${document.title} ${document.body?.innerText ?? ""} ${document.body?.textContent ?? ""}`.toLowerCase();

  return Boolean(
    form
    && username
    && password
    && hasSubmit
    && (document.title.toLowerCase().includes("login page") || text.includes("e-perakam waktu online"))
  );
}

async function detectAttendanceControls(page: Page, checkedAt: string): Promise<AttendanceControlDetection> {
  const frameResults = await Promise.all(
    page.frames().map(async (frame) => {
      try {
        return await frame.evaluate(readAttendanceControlsFromDocument);
      } catch {
        return null;
      }
    })
  );

  const results = frameResults.filter((result): result is AttendanceControlDetection => result !== null);

  if (results.length === 0) {
    return unknownAttendanceControls("Unable to inspect page controls read-only.", checkedAt);
  }

  return {
    clockInAvailable: mergeControlAvailability(results.map((result) => result.clockInAvailable)),
    clockOutAvailable: mergeControlAvailability(results.map((result) => result.clockOutAvailable)),
    clockInReason: mergeControlReason(results.map((result) => ({
      availability: result.clockInAvailable,
      reason: result.clockInReason
    }))),
    clockOutReason: mergeControlReason(results.map((result) => ({
      availability: result.clockOutAvailable,
      reason: result.clockOutReason
    }))),
    lastButtonCheckAt: checkedAt
  };
}

async function retryAttendanceControlsIfDashboardMarkersExist(
  page: Page,
  markers: PerakamPageMarkers | null,
  firstResult: AttendanceControlDetection
): Promise<AttendanceControlDetection> {
  if (
    !markers?.hasDashboardAncestry
    || firstResult.clockInAvailable === "available"
    || firstResult.clockOutAvailable === "available"
  ) {
    return firstResult;
  }

  const delays = [500, 1000, 2000];
  let latest = firstResult;

  for (const delay of delays) {
    await page.waitForTimeout(delay);
    latest = await detectAttendanceControls(page, new Date().toISOString());

    if (latest.clockInAvailable === "available" || latest.clockOutAvailable === "available") {
      return latest;
    }
  }

  return latest;
}

function readAttendanceControlsFromDocument(): AttendanceControlDetection {
  const checkedAt = new Date().toISOString();

  function detectControl(options: { id: string; labels: string[] }): ControlProbeResult {
    const idCandidates = Array.from(document.querySelectorAll<HTMLElement>(`[id="${options.id}"]`));
    const labelCandidates = Array.from(
      document.querySelectorAll<HTMLElement>("button,input,a,[role='button']")
    ).filter((element) => {
      const label = controlText(element);
      return options.labels.some((expected) => label.includes(expected));
    });
    const fallbackCandidates = dashboardFallbackCandidates(options.labels);
    const candidates = uniqueElements([...idCandidates, ...labelCandidates, ...fallbackCandidates]);

    if (candidates.length === 0) {
      return {
        availability: "unknown",
        reason: `${options.id} not found and no clear label/dashboard fallback was found.`
      };
    }

    const probes = candidates.map((candidate) => {
      const source = idCandidates.includes(candidate)
        ? `${options.id} candidate`
        : fallbackCandidates.includes(candidate)
          ? "dashboard text fallback candidate"
          : "label fallback candidate";
      return {
        ...describeControl(candidate, source),
        isExplicitId: idCandidates.includes(candidate)
      };
    });
    const explicitAvailable = probes.filter((probe) => probe.isExplicitId && probe.availability === "available");
    const available = probes.filter((probe) => probe.availability === "available");
    const visible = probes.filter((probe) => probe.visible);
    const enabled = probes.filter((probe) => probe.enabled);
    const visibleActionable = probes.filter((probe) => probe.visible && probe.enabled && probe.actionable);
    const dashboardAvailable = probes.filter((probe) => probe.dashboardCandidate && probe.availability === "available");
    const hiddenOrDisabled = probes.filter(
      (probe) => probe.availability === "unavailable" && (probe.hiddenSidebar || !probe.visible || !probe.enabled)
    );

    if (available.length > 0) {
      const hasHiddenSidebar = probes.some((probe) => probe.hiddenSidebar);
      const hasDescendantTile = probes.some((probe) => probe.descendantVisible && probe.availability === "available");
      const hasFallbackAvailable = probes.some((probe) => probe.reason.includes("dashboard text fallback candidate") && probe.availability === "available");
      const detail = hasHiddenSidebar && dashboardAvailable.length > 0
        ? "hidden sidebar candidate ignored; visible dashboard candidate found"
        : hasFallbackAvailable
          ? "dashboard text fallback accepted visible dashboard descendant"
        : hasDescendantTile
          ? "candidate element hidden/zero-sized but visible descendant found; dashboard tile candidate found"
        : "visible/actionable candidate found";

      return {
        availability: "available",
        reason: candidateSummary(candidates.length, visible.length, enabled.length, visibleActionable.length, detail)
      };
    }

    if (hiddenOrDisabled.length === candidates.length) {
      const sidebarCount = probes.filter((probe) => probe.hiddenSidebar).length;
      const dashboardCount = probes.filter((probe) => probe.dashboardCandidate).length;
      const firstReason = probes.find((probe) => probe.reason)?.reason ?? "all hidden or disabled";
      return {
        availability: "unavailable",
        reason: candidateSummary(
          candidates.length,
          visible.length,
          enabled.length,
          visibleActionable.length,
          `all hidden or disabled; ${sidebarCount} sidebar candidate(s); ${dashboardCount} dashboard-area candidate(s); ${firstReason}`
        )
      };
    }

    const firstReason = probes.find((probe) => probe.reason)?.reason ?? "availability is uncertain";
    return {
      availability: "unknown",
      reason: candidateSummary(candidates.length, visible.length, enabled.length, visibleActionable.length, `availability is uncertain; ${firstReason}`)
    };
  }

  function describeControl(element: Element, source: string): ControlProbeResult {
    if (!(element instanceof HTMLElement)) {
      return {
        availability: "unknown",
        reason: `${source}; element is not an HTML element.`,
        visible: false,
        enabled: false,
        actionable: false,
        hiddenSidebar: false,
        dashboardCandidate: false,
        descendantVisible: false
      };
    }

    const visibility = inspectVisibility(element);
    const visible = visibility.visible;
    const enabled = !isDisabled(element);
    const actionable = isLikelyActionable(element);

    if (visibility.hiddenSidebar && !visibility.dashboardCandidate) {
      return {
        availability: "unavailable",
        reason: `${source}; rejected hidden sidebar candidate; hidden sidebar ancestry detected.`,
        visible: false,
        enabled,
        actionable,
        hiddenSidebar: true,
        dashboardCandidate: false,
        descendantVisible: visibility.descendantVisible
      };
    }

    if (!visible) {
      return {
        availability: "unavailable",
        reason: `${source}; ${visibility.reason}; ${visibility.dashboardCandidate ? "dashboard tile ancestry detected" : "no dashboard tile ancestry detected"}${visibility.hiddenSidebar ? "; hidden sidebar ancestry detected" : ""}.`,
        visible,
        enabled,
        actionable,
        hiddenSidebar: visibility.hiddenSidebar,
        dashboardCandidate: visibility.dashboardCandidate,
        descendantVisible: visibility.descendantVisible
      };
    }

    if (!enabled) {
      return {
        availability: "unavailable",
        reason: `${source}; element is disabled; ${visibility.dashboardCandidate ? "dashboard tile ancestry detected" : "no dashboard tile ancestry detected"}.`,
        visible,
        enabled,
        actionable,
        hiddenSidebar: visibility.hiddenSidebar,
        dashboardCandidate: visibility.dashboardCandidate,
        descendantVisible: visibility.descendantVisible
      };
    }

    if (!actionable) {
      return {
        availability: "unknown",
        reason: `${source}; element is visible but not clearly actionable; ${visibility.reason}.`,
        visible,
        enabled,
        actionable,
        hiddenSidebar: visibility.hiddenSidebar,
        dashboardCandidate: visibility.dashboardCandidate,
        descendantVisible: visibility.descendantVisible
      };
    }

    return {
      availability: "available",
      reason: `${source}; element is visible and enabled; ${visibility.reason}; ${visibility.dashboardCandidate ? "dashboard tile ancestry detected" : "no dashboard tile ancestry detected"}.`,
      visible,
      enabled,
      actionable,
      hiddenSidebar: visibility.hiddenSidebar,
      dashboardCandidate: visibility.dashboardCandidate,
      descendantVisible: visibility.descendantVisible
    };
  }

  function inspectVisibility(element: HTMLElement): {
    visible: boolean;
    reason: string;
    hiddenSidebar: boolean;
    dashboardCandidate: boolean;
    descendantVisible: boolean;
  } {
    const rect = element.getBoundingClientRect();
    let current: HTMLElement | null = element;
    let hiddenSidebar = false;
    let dashboardCandidate = isDashboardCandidate(element);

    while (current) {
      const style = window.getComputedStyle(current);
      const isHiddenSidebar = isHiddenSidebarMenu(current);
      hiddenSidebar = hiddenSidebar || isHiddenSidebar;
      dashboardCandidate = dashboardCandidate || isDashboardCandidate(current);

      if (current.hidden || current.getAttribute("aria-hidden") === "true") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is hidden",
          hiddenSidebar,
          dashboardCandidate,
          descendantVisible: false
        };
      }

      if (style.display === "none") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor uses display none",
          hiddenSidebar,
          dashboardCandidate,
          descendantVisible: false
        };
      }

      if (style.visibility === "hidden" || style.visibility === "collapse") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is visibility hidden",
          hiddenSidebar,
          dashboardCandidate,
          descendantVisible: false
        };
      }

      if (style.opacity === "0") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is transparent",
          hiddenSidebar,
          dashboardCandidate,
          descendantVisible: false
        };
      }

      current = current.parentElement;
    }

    const ownRectVisible = rect.width > 0 && rect.height > 0;
    const descendantVisible = hasVisibleMeaningfulDescendant(element, hiddenSidebar ? [] : dashboardTextHints(element));

    if (ownRectVisible) {
      return {
        visible: true,
        reason: "candidate own rect visible",
        hiddenSidebar,
        dashboardCandidate,
        descendantVisible
      };
    }

    if (descendantVisible) {
      return {
        visible: true,
        reason: "candidate rect zero; descendant rect visible; accepted visible dashboard descendant",
        hiddenSidebar,
        dashboardCandidate: true,
        descendantVisible
      };
    }

    return {
      visible: false,
      reason: hiddenSidebar ? "hidden sidebar menu candidate" : "candidate rect zero; no visible meaningful descendant found",
      hiddenSidebar,
      dashboardCandidate,
      descendantVisible
    };
  }

  function isHiddenSidebarMenu(element: HTMLElement): boolean {
    return element.matches("ul.nav.child_menu, #sidebar-menu, .left_col");
  }

  function isDashboardCandidate(element: HTMLElement): boolean {
    return element.matches(".top_tiles, .right_col, .tile-stats") || Boolean(element.closest(".top_tiles, .right_col, .tile-stats"));
  }

  function hasVisibleMeaningfulDescendant(element: HTMLElement, textHints: string[]): boolean {
    return Array.from(element.querySelectorAll<HTMLElement>(".tile-stats, .animated, .count, h3, div, span, p"))
      .slice(0, 20)
      .some((descendant) => {
        if (!isElementBoxVisible(descendant)) {
          return false;
        }

        if (descendant.matches(".tile-stats, .animated, .count, h3")) {
          return true;
        }

        const text = controlText(descendant);
        return textHints.some((hint) => text.includes(hint));
      });
  }

  function isElementBoxVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none"
      && style.visibility !== "hidden"
      && style.visibility !== "collapse"
      && style.opacity !== "0"
      && rect.width > 0
      && rect.height > 0
      && !element.hidden
      && element.getAttribute("aria-hidden") !== "true"
    );
  }

  function isDisabled(element: HTMLElement): boolean {
    const formControl = element as HTMLButtonElement | HTMLInputElement;
    return (
      Boolean(formControl.disabled)
      || element.getAttribute("aria-disabled") === "true"
      || element.classList.contains("disabled")
    );
  }

  function isLikelyActionable(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "button") {
      return true;
    }

    if (tagName === "input") {
      const type = (element.getAttribute("type") ?? "").toLowerCase();
      return ["button", "submit", "image"].includes(type);
    }

    if (tagName === "a") {
      return Boolean(element.getAttribute("href"));
    }

    return (
      element.getAttribute("role") === "button"
      || Boolean(element.getAttribute("onclick"))
      || Boolean(element.getAttribute("data-link"))
    );
  }

  function dashboardFallbackCandidates(labels: string[]): HTMLElement[] {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(".right_col .top_tiles, .right_col, .top_tiles"));
    const candidates: HTMLElement[] = [];

    for (const root of roots) {
      const clickable = Array.from(root.querySelectorAll<HTMLElement>("a,button,input,[role='button'],[data-link='link'],[onclick]"))
        .filter((element) => labels.some((label) => controlText(element).includes(label)));
      const textHits = Array.from(root.querySelectorAll<HTMLElement>(".tile-stats, .animated, .count, h3, div, p, span"))
        .filter((element) => labels.some((label) => controlText(element).includes(label)))
        .map((element) => nearestDashboardClickable(element))
        .filter((element): element is HTMLElement => element !== null);

      candidates.push(...clickable, ...textHits);
    }

    return uniqueElements(candidates).filter((element) => !isInsideHiddenSidebarArea(element));
  }

  function nearestDashboardClickable(element: HTMLElement): HTMLElement | null {
    if (isInsideHiddenSidebarArea(element)) {
      return null;
    }

    const nearest = element.closest<HTMLElement>("a,button,input,[role='button'],[data-link='link'],[onclick]");
    if (nearest && nearest.closest(".right_col, .top_tiles")) {
      return nearest;
    }

    const tile = element.closest<HTMLElement>(".tile-stats, .animated");
    if (!tile) {
      return null;
    }

    const tileActionable = tile.querySelector<HTMLElement>("a,button,input,[role='button'],[data-link='link'],[onclick]");
    if (tileActionable) {
      return tileActionable;
    }

    return isLikelyActionable(tile) ? tile : null;
  }

  function isInsideHiddenSidebarArea(element: HTMLElement): boolean {
    return Boolean(element.closest("ul.nav.child_menu, #sidebar-menu, .left_col"));
  }

  function dashboardTextHints(element: HTMLElement): string[] {
    const text = controlText(element);
    const hints = ["masa hadir", "klik masuk", "masa keluar", "klik keluar"].filter((hint) => text.includes(hint));
    return hints.length > 0 ? hints : ["masa hadir", "klik masuk", "masa keluar", "klik keluar"];
  }

  function controlText(element: HTMLElement): string {
    const value = element instanceof HTMLInputElement ? element.value : "";
    return [
      element.innerText,
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      value
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();
  }

  function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
    return Array.from(new Set(elements));
  }

  function candidateSummary(
    foundCount: number,
    visibleCount: number,
    enabledCount: number,
    visibleActionableCount: number,
    detail: string
  ): string {
    return `${foundCount} candidates found; ${visibleCount} visible; ${enabledCount} enabled; ${visibleActionableCount} visible/actionable; ${detail}.`;
  }

  const clockIn = detectControl({
    id: "a50",
    labels: ["clock in", "clock-in", "masuk", "masuk kerja", "waktu masuk", "masa hadir", "klik masuk"]
  });
  const clockOut = detectControl({
    id: "a51",
    labels: ["clock out", "clock-out", "keluar", "balik", "waktu keluar", "masa keluar", "klik keluar"]
  });

  return {
    clockInAvailable: clockIn.availability,
    clockOutAvailable: clockOut.availability,
    clockInReason: clockIn.reason,
    clockOutReason: clockOut.reason,
    lastButtonCheckAt: checkedAt
  };
}

function readTestClickTargetDiagnosticsFromDocument(checkedAt: string): TestClickTargetDiagnostics {
  function inspectTarget(targetId: TestClickTargetId): TestClickTargetCandidateDiagnostic[] {
    return Array.from(document.querySelectorAll<HTMLElement>(`[id="${targetId}"]`)).map((candidate, candidateIndex) => {
      const decision = describeCandidate(candidate);
      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      const nearestAnchor = candidate.closest<HTMLElement>("a");
      const nearestButton = candidate.closest<HTMLElement>("button");
      const nearestRoleButton = candidate.closest<HTMLElement>("[role='button']");
      const nearestLi = candidate.closest<HTMLElement>("li");
      const nearestUl = candidate.closest<HTMLElement>("ul");

      return {
        targetId,
        candidateIndex,
        tagName: candidate.tagName.toLowerCase(),
        id: bounded(candidate.id),
        name: bounded(candidate.getAttribute("name")),
        type: bounded(candidate.getAttribute("type")),
        href: sanitizeHref(candidate.getAttribute("href")),
        className: bounded(candidate.className),
        role: bounded(candidate.getAttribute("role")),
        ariaHidden: bounded(candidate.getAttribute("aria-hidden")),
        hidden: candidate.hidden,
        disabled: isDisabled(candidate),
        textSnippet: bounded(candidate.innerText || candidate.textContent),
        valueSnippet: candidate instanceof HTMLInputElement ? bounded(candidate.value) : null,
        title: bounded(candidate.getAttribute("title")),
        nearestAnchor: summarizeElement(nearestAnchor),
        nearestButton: summarizeElement(nearestButton),
        nearestRoleButton: summarizeElement(nearestRoleButton),
        nearestLiClass: bounded(nearestLi?.className ?? null),
        nearestUlClass: bounded(nearestUl?.className ?? null),
        insideChildMenu: Boolean(candidate.closest("ul.nav.child_menu")),
        insideSidebarMenu: Boolean(candidate.closest("#sidebar-menu")),
        insideLeftCol: Boolean(candidate.closest(".left_col")),
        insideRightCol: Boolean(candidate.closest(".right_col")),
        insideTopTiles: Boolean(candidate.closest(".top_tiles")),
        computedDisplay: style.display,
        computedVisibility: style.visibility,
        computedOpacity: style.opacity,
        boundingRect: {
          width: roundRectValue(rect.width),
          height: roundRectValue(rect.height),
          top: roundRectValue(rect.top),
          left: roundRectValue(rect.left)
        },
        offsetParentPresent: candidate.offsetParent !== null,
        ownVisible: decision.ownVisible,
        meaningfulDescendantVisible: decision.meaningfulDescendantVisible,
        detectorDecision: decision.availability,
        rejectionReason: decision.reason
      };
    });
  }

  function describeCandidate(element: HTMLElement): {
    availability: AttendanceControlAvailability;
    reason: string;
    ownVisible: boolean;
    meaningfulDescendantVisible: boolean;
  } {
    const visibility = inspectVisibility(element);
    const enabled = !isDisabled(element);
    const actionable = isLikelyActionable(element) || Boolean(nearestActionable(element));

    if (!visibility.visible) {
      return {
        availability: "unavailable",
        reason: visibility.hiddenSidebar
          ? "Target exists but is hidden in the sidebar. Manually expand the relevant Perakam menu in the browser, then check readiness again."
          : visibility.reason,
        ownVisible: visibility.ownVisible,
        meaningfulDescendantVisible: visibility.meaningfulDescendantVisible
      };
    }

    if (!enabled) {
      return {
        availability: "unavailable",
        reason: "Target is visible but disabled.",
        ownVisible: visibility.ownVisible,
        meaningfulDescendantVisible: visibility.meaningfulDescendantVisible
      };
    }

    if (!actionable) {
      return {
        availability: "unknown",
        reason: "Target is visible but no actionable anchor, button, input, or role=button was found.",
        ownVisible: visibility.ownVisible,
        meaningfulDescendantVisible: visibility.meaningfulDescendantVisible
      };
    }

    return {
      availability: "available",
      reason: "Target is visible, enabled, and has an actionable candidate.",
      ownVisible: visibility.ownVisible,
      meaningfulDescendantVisible: visibility.meaningfulDescendantVisible
    };
  }

  function inspectVisibility(element: HTMLElement): {
    visible: boolean;
    reason: string;
    hiddenSidebar: boolean;
    ownVisible: boolean;
    meaningfulDescendantVisible: boolean;
  } {
    let current: HTMLElement | null = element;
    let hiddenSidebar = false;

    while (current) {
      const style = window.getComputedStyle(current);
      const isHiddenSidebar = current.matches("ul.nav.child_menu, #sidebar-menu, .left_col");
      hiddenSidebar = hiddenSidebar || isHiddenSidebar;

      if (current.hidden || current.getAttribute("aria-hidden") === "true") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is hidden",
          hiddenSidebar,
          ownVisible: false,
          meaningfulDescendantVisible: false
        };
      }

      if (style.display === "none") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor uses display none",
          hiddenSidebar,
          ownVisible: false,
          meaningfulDescendantVisible: false
        };
      }

      if (style.visibility === "hidden" || style.visibility === "collapse") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is visibility hidden",
          hiddenSidebar,
          ownVisible: false,
          meaningfulDescendantVisible: false
        };
      }

      if (style.opacity === "0") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is transparent",
          hiddenSidebar,
          ownVisible: false,
          meaningfulDescendantVisible: false
        };
      }

      current = current.parentElement;
    }

    const rect = element.getBoundingClientRect();
    const ownVisible = rect.width > 0 && rect.height > 0;
    const meaningfulDescendantVisible = Array.from(element.querySelectorAll<HTMLElement>(".tile-stats, .animated, div, h3, .count, span, i"))
      .slice(0, 30)
      .some((descendant) => {
        const descendantStyle = window.getComputedStyle(descendant);
        const descendantRect = descendant.getBoundingClientRect();
        return (
          descendantStyle.display !== "none"
          && descendantStyle.visibility !== "hidden"
          && descendantStyle.visibility !== "collapse"
          && descendantStyle.opacity !== "0"
          && descendantRect.width > 0
          && descendantRect.height > 0
          && !descendant.hidden
          && descendant.getAttribute("aria-hidden") !== "true"
        );
      });

    return {
      visible: ownVisible || meaningfulDescendantVisible,
      reason: ownVisible ? "candidate own rect visible" : meaningfulDescendantVisible ? "meaningful descendant visible" : "candidate and meaningful descendants have zero bounding box",
      hiddenSidebar,
      ownVisible,
      meaningfulDescendantVisible
    };
  }

  function nearestActionable(element: HTMLElement): HTMLElement | null {
    return element.closest<HTMLElement>("a,button,input,[role='button']");
  }

  function isLikelyActionable(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "button") {
      return true;
    }

    if (tagName === "input") {
      const type = (element.getAttribute("type") ?? "").toLowerCase();
      return ["button", "submit", "image"].includes(type);
    }

    if (tagName === "a") {
      return Boolean(element.getAttribute("href"));
    }

    return element.getAttribute("role") === "button";
  }

  function isDisabled(element: HTMLElement): boolean {
    const formControl = element as HTMLButtonElement | HTMLInputElement;
    return Boolean(formControl.disabled) || element.getAttribute("aria-disabled") === "true" || element.classList.contains("disabled");
  }

  function summarizeElement(element: HTMLElement | null): TestClickTargetCandidateDiagnostic["nearestAnchor"] {
    if (!element) {
      return null;
    }

    return {
      tagName: element.tagName.toLowerCase(),
      id: bounded(element.id),
      className: bounded(element.className),
      role: bounded(element.getAttribute("role")),
      href: sanitizeHref(element.getAttribute("href")),
      textSnippet: bounded(element.innerText || element.textContent)
    };
  }

  function sanitizeHref(href: string | null): string | null {
    if (!href) {
      return null;
    }

    try {
      const parsed = new URL(href, window.location.href);
      parsed.username = "";
      parsed.password = "";
      parsed.search = parsed.search ? "?[redacted]" : "";
      parsed.hash = parsed.hash ? "#[redacted]" : "";
      return parsed.toString();
    } catch {
      return href.replace(/[?#].*$/, "?[redacted]").slice(0, 120);
    }
  }

  function bounded(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized ? normalized.slice(0, 120) : null;
  }

  function roundRectValue(value: number): number {
    return Math.round(value * 100) / 100;
  }

  return {
    checkedAt,
    targets: {
      a56: inspectTarget("a56"),
      a57: inspectTarget("a57")
    }
  };
}

function clickTestClickTargetInDocument(input: {
  targetId: TestClickTargetId;
  checkedAt: string;
}): { clicked: boolean; target: TestClickTargetSnapshot } {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[id="${input.targetId}"]`));
  const probe = candidates
    .map((candidate) => ({
      candidate,
      result: describeClickCandidate(candidate)
    }))
    .find((entry) => entry.result.availability === "available");

  if (!probe) {
    return {
      clicked: false,
      target: {
        targetId: input.targetId,
        availability: "unavailable",
        reason: "No visible validated test click target was found.",
        checkedAt: input.checkedAt
      }
    };
  }

  probe.candidate.click();
  return {
    clicked: true,
    target: {
      targetId: input.targetId,
      availability: "available",
      reason: probe.result.reason,
      checkedAt: input.checkedAt
    }
  };

  function describeClickCandidate(element: HTMLElement): { availability: AttendanceControlAvailability; reason: string } {
    const visibility = inspectClickVisibility(element);
    const enabled = !isDisabled(element);
    const actionable = isLikelyActionable(element) || Boolean(element.closest("a,button,input,[role='button']"));

    if (!visibility.visible) {
      return {
        availability: "unavailable",
        reason: visibility.hiddenSidebar
          ? "Target exists but is hidden in the sidebar. Manually expand the relevant Perakam menu in the browser, then check readiness again."
          : visibility.reason
      };
    }

    if (!enabled) {
      return {
        availability: "unavailable",
        reason: "Target is visible but disabled."
      };
    }

    if (!actionable) {
      return {
        availability: "unknown",
        reason: "Target is visible but no actionable anchor, button, input, or role=button was found."
      };
    }

    return {
      availability: "available",
      reason: "Target is visible, enabled, and selected for one manual test click."
    };
  }

  function inspectClickVisibility(element: HTMLElement): { visible: boolean; reason: string; hiddenSidebar: boolean } {
    let current: HTMLElement | null = element;
    let hiddenSidebar = false;

    while (current) {
      const style = window.getComputedStyle(current);
      const isHiddenSidebar = current.matches("ul.nav.child_menu, #sidebar-menu, .left_col");
      hiddenSidebar = hiddenSidebar || isHiddenSidebar;

      if (current.hidden || current.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is hidden",
          hiddenSidebar
        };
      }

      current = current.parentElement;
    }

    const rect = element.getBoundingClientRect();
    const ownVisible = rect.width > 0 && rect.height > 0;
    const descendantVisible = Array.from(element.querySelectorAll<HTMLElement>(".tile-stats, .animated, div, h3, .count, span, i"))
      .slice(0, 30)
      .some((descendant) => {
        const descendantStyle = window.getComputedStyle(descendant);
        const descendantRect = descendant.getBoundingClientRect();
        return descendantStyle.display !== "none"
          && descendantStyle.visibility !== "hidden"
          && descendantStyle.visibility !== "collapse"
          && descendantStyle.opacity !== "0"
          && descendantRect.width > 0
          && descendantRect.height > 0
          && !descendant.hidden
          && descendant.getAttribute("aria-hidden") !== "true";
      });

    return {
      visible: ownVisible || descendantVisible,
      reason: ownVisible ? "candidate own rect visible" : descendantVisible ? "meaningful descendant visible" : "candidate and meaningful descendants have zero bounding box",
      hiddenSidebar
    };
  }

  function isDisabled(element: HTMLElement): boolean {
    const formControl = element as HTMLButtonElement | HTMLInputElement;
    return Boolean(formControl.disabled) || element.getAttribute("aria-disabled") === "true" || element.classList.contains("disabled");
  }

  function isLikelyActionable(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "button") {
      return true;
    }

    if (tagName === "input") {
      const type = (element.getAttribute("type") ?? "").toLowerCase();
      return ["button", "submit", "image"].includes(type);
    }

    if (tagName === "a") {
      return Boolean(element.getAttribute("href"));
    }

    return element.getAttribute("role") === "button";
  }
}

function clickAttendanceControlInDocument(input: {
  action: AttendanceActionType;
  mappedTargetId: "a50" | "a51";
  checkedAt: string;
}): { clicked: boolean; controlAvailability: AttendanceControlSnapshot } {
  const labels = input.action === "clock-in"
    ? ["masa hadir", "klik masuk", "clock in", "clock-in", "masuk"]
    : ["masa keluar", "klik keluar", "clock out", "clock-out", "keluar"];
  const idCandidates = Array.from(document.querySelectorAll<HTMLElement>(`[id="${input.mappedTargetId}"]`));
  const candidates = uniqueElements([...idCandidates, ...dashboardFallbackCandidates(labels)]);
  const probes = candidates.map((candidate) => ({
    candidate,
    result: describeAttendanceClickCandidate(candidate, labels)
  }));
  const dashboardProbe = probes.find((entry) => entry.result.availability === "available");

  if (!dashboardProbe) {
    const hiddenCount = probes.filter((entry) => entry.result.hiddenSidebar).length;
    const visibleCount = probes.filter((entry) => entry.result.visible).length;
    const reason = candidates.length === 0
      ? `${input.mappedTargetId} was not found.`
      : `${candidates.length} candidates found; ${visibleCount} visible dashboard/actionable; ${hiddenCount} hidden sidebar candidate(s) ignored. No validated target control was clicked.`;

    return {
      clicked: false,
      controlAvailability: {
        availability: candidates.length > 0 ? "unavailable" : "unknown",
        reason,
        checkedAt: input.checkedAt
      }
    };
  }

  dashboardProbe.candidate.click();
  return {
    clicked: true,
    controlAvailability: {
      availability: "available",
      reason: dashboardProbe.result.reason,
      checkedAt: input.checkedAt
    }
  };

  function describeAttendanceClickCandidate(
    element: HTMLElement,
    expectedLabels: string[]
  ): {
    availability: AttendanceControlAvailability;
    reason: string;
    visible: boolean;
    hiddenSidebar: boolean;
  } {
    const visibility = inspectAttendanceClickVisibility(element);
    const enabled = !isDisabled(element);
    const actionable = isLikelyActionable(element) || Boolean(element.closest("a,button,input,[role='button'],[data-link='link'],[onclick]"));
    const labelText = controlText(element);
    const labelMatches = expectedLabels.some((label) => labelText.includes(label));

    if (visibility.hiddenSidebar) {
      return {
        availability: "unavailable",
        reason: "Hidden sidebar target candidate ignored.",
        visible: false,
        hiddenSidebar: true
      };
    }

    if (!visibility.dashboardCandidate) {
      return {
        availability: "unknown",
        reason: "Candidate is not in the visible dashboard tile area.",
        visible: visibility.visible,
        hiddenSidebar: false
      };
    }

    if (!visibility.visible) {
      return {
        availability: "unavailable",
        reason: visibility.reason,
        visible: false,
        hiddenSidebar: false
      };
    }

    if (!enabled) {
      return {
        availability: "unavailable",
        reason: "Dashboard target candidate is visible but disabled.",
        visible: true,
        hiddenSidebar: false
      };
    }

    if (!actionable) {
      return {
        availability: "unknown",
        reason: "Dashboard target candidate is visible but not clearly actionable.",
        visible: true,
        hiddenSidebar: false
      };
    }

    if (!labelMatches) {
      return {
        availability: "unknown",
        reason: "Dashboard target candidate is visible but label context is ambiguous.",
        visible: true,
        hiddenSidebar: false
      };
    }

    return {
      availability: "available",
      reason: `${input.mappedTargetId} visible dashboard tile validated for one ${input.action} click.`,
      visible: true,
      hiddenSidebar: false
    };
  }

  function inspectAttendanceClickVisibility(element: HTMLElement): {
    visible: boolean;
    reason: string;
    hiddenSidebar: boolean;
    dashboardCandidate: boolean;
  } {
    let current: HTMLElement | null = element;
    let hiddenSidebar = false;
    let dashboardCandidate = Boolean(element.closest(".top_tiles, .right_col, .tile-stats"));

    while (current) {
      const style = window.getComputedStyle(current);
      const isHiddenSidebar = current.matches("ul.nav.child_menu, #sidebar-menu, .left_col");
      hiddenSidebar = hiddenSidebar || isHiddenSidebar;
      dashboardCandidate = dashboardCandidate || current.matches(".top_tiles, .right_col, .tile-stats");

      if (current.hidden || current.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") {
        return {
          visible: false,
          reason: isHiddenSidebar ? "hidden sidebar menu candidate" : "element or ancestor is hidden",
          hiddenSidebar,
          dashboardCandidate
        };
      }

      current = current.parentElement;
    }

    const rect = element.getBoundingClientRect();
    const ownVisible = rect.width > 0 && rect.height > 0;
    const descendantVisible = Array.from(element.querySelectorAll<HTMLElement>(".tile-stats, .animated, div, h3, .count, span, i"))
      .slice(0, 30)
      .some((descendant) => {
        const style = window.getComputedStyle(descendant);
        const descendantRect = descendant.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && style.visibility !== "collapse"
          && style.opacity !== "0"
          && descendantRect.width > 0
          && descendantRect.height > 0
          && !descendant.hidden
          && descendant.getAttribute("aria-hidden") !== "true";
      });

    return {
      visible: ownVisible || descendantVisible,
      reason: ownVisible ? "candidate own rect visible" : descendantVisible ? "descendant dashboard tile visible" : "candidate and meaningful descendants have zero bounding box",
      hiddenSidebar,
      dashboardCandidate
    };
  }

  function isDisabled(element: HTMLElement): boolean {
    const formControl = element as HTMLButtonElement | HTMLInputElement;
    return Boolean(formControl.disabled) || element.getAttribute("aria-disabled") === "true" || element.classList.contains("disabled");
  }

  function isLikelyActionable(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "button") {
      return true;
    }

    if (tagName === "input") {
      const type = (element.getAttribute("type") ?? "").toLowerCase();
      return ["button", "submit", "image"].includes(type);
    }

    if (tagName === "a") {
      return Boolean(element.getAttribute("href"));
    }

    return element.getAttribute("role") === "button"
      || Boolean(element.getAttribute("onclick"))
      || Boolean(element.getAttribute("data-link"));
  }

  function dashboardFallbackCandidates(labels: string[]): HTMLElement[] {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(".right_col .top_tiles, .right_col, .top_tiles"));
    const candidates: HTMLElement[] = [];

    for (const root of roots) {
      const clickable = Array.from(root.querySelectorAll<HTMLElement>("a,button,input,[role='button'],[data-link='link'],[onclick]"))
        .filter((element) => labels.some((label) => controlText(element).includes(label)));
      const textHits = Array.from(root.querySelectorAll<HTMLElement>(".tile-stats, .animated, .count, h3, div, p, span"))
        .filter((element) => labels.some((label) => controlText(element).includes(label)))
        .map((element) => nearestDashboardClickable(element))
        .filter((element): element is HTMLElement => element !== null);

      candidates.push(...clickable, ...textHits);
    }

    return uniqueElements(candidates).filter((element) => !element.closest("ul.nav.child_menu, #sidebar-menu, .left_col"));
  }

  function nearestDashboardClickable(element: HTMLElement): HTMLElement | null {
    if (element.closest("ul.nav.child_menu, #sidebar-menu, .left_col")) {
      return null;
    }

    const nearest = element.closest<HTMLElement>("a,button,input,[role='button'],[data-link='link'],[onclick]");
    if (nearest && nearest.closest(".right_col, .top_tiles")) {
      return nearest;
    }

    const tile = element.closest<HTMLElement>(".tile-stats, .animated");
    if (!tile) {
      return null;
    }

    const tileActionable = tile.querySelector<HTMLElement>("a,button,input,[role='button'],[data-link='link'],[onclick]");
    if (tileActionable) {
      return tileActionable;
    }

    return isLikelyActionable(tile) ? tile : null;
  }

  function controlText(element: HTMLElement): string {
    return [
      element.innerText,
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title")
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toLowerCase();
  }

  function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
    return Array.from(new Set(elements));
  }
}

function readAttendanceVerificationFromDocument(input: {
  action: AttendanceActionType;
}): { status: AttendanceVerificationStatus; reason: string; snippets: string[] } {
  function localBoundedSnippet(value: string): string {
    return value.replace(/\s+/g, " ").trim().slice(0, 180);
  }

  const normalizedText = localBoundedSnippet(document.body?.innerText || document.body?.textContent || "");
  const snippets = collectEvidenceSnippets(input.action);
  const lowerText = normalizedText.toLowerCase();
  const successPhrases = [
    "berjaya",
    "success",
    "telah direkod",
    "rekod berjaya",
    "masa hadir",
    "masa keluar"
  ];
  const failurePhrases = [
    "gagal",
    "failed",
    "error",
    "ralat",
    "tidak berjaya",
    "sila cuba"
  ];
  const hasFailure = failurePhrases.some((phrase) => lowerText.includes(phrase));
  const hasSuccess = successPhrases.some((phrase) => lowerText.includes(phrase));
  const controlStillVisible = isAttendanceControlVisible(input.action);

  if (hasFailure) {
    return {
      status: "verification-failed",
      reason: "Visible page text appears to contain an error or rejection.",
      snippets
    };
  }

  if (hasSuccess && !controlStillVisible) {
    return {
      status: "verified-success",
      reason: "Success-like text is visible and the clicked control is no longer visibly available.",
      snippets
    };
  }

  if (!controlStillVisible && snippets.length > 0) {
    return {
      status: "verification-unknown",
      reason: "Clicked control disappeared, but success could not be confirmed confidently.",
      snippets
    };
  }

  return {
    status: "verification-unknown",
    reason: "No conclusive read-only success or failure evidence found.",
    snippets
  };

  function collectEvidenceSnippets(action: AttendanceActionType): string[] {
    const phrases = action === "clock-in"
      ? ["berjaya", "success", "masa hadir", "klik masuk", "hadir", "gagal", "ralat", "error"]
      : ["berjaya", "success", "masa keluar", "klik keluar", "keluar", "gagal", "ralat", "error"];
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(".alert, .notification, .toast, .swal2-title, .swal2-html-container, .modal, .panel, .tile-stats, body"))
      .slice(0, 40)
      .map((element) => localBoundedSnippet(element.innerText || element.textContent || ""))
      .filter((text) => {
        const lower = text.toLowerCase();
        return text.length > 0 && phrases.some((phrase) => lower.includes(phrase));
      });

    return Array.from(new Set(candidates)).slice(0, 5);
  }

  function isAttendanceControlVisible(action: AttendanceActionType): boolean {
    const id = action === "clock-in" ? "a50" : "a51";
    return Array.from(document.querySelectorAll<HTMLElement>(`[id="${id}"]`))
      .some((element) => isVisibleDashboardElement(element));
  }

  function isVisibleDashboardElement(element: HTMLElement): boolean {
    if (!element.closest(".top_tiles, .right_col, .tile-stats")) {
      return false;
    }

    let current: HTMLElement | null = element;
    while (current) {
      const style = window.getComputedStyle(current);
      if (current.matches("ul.nav.child_menu, #sidebar-menu, .left_col")) {
        return false;
      }

      if (current.hidden || current.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || style.opacity === "0") {
        return false;
      }

      current = current.parentElement;
    }

    const rect = element.getBoundingClientRect();
    const ownVisible = rect.width > 0 && rect.height > 0;
    const descendantVisible = Array.from(element.querySelectorAll<HTMLElement>(".tile-stats, .animated, div, h3, .count, span, i"))
      .slice(0, 20)
      .some((descendant) => {
        const style = window.getComputedStyle(descendant);
        const descendantRect = descendant.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && style.visibility !== "collapse"
          && style.opacity !== "0"
          && descendantRect.width > 0
          && descendantRect.height > 0
          && !descendant.hidden
          && descendant.getAttribute("aria-hidden") !== "true";
      });

    return ownVisible || descendantVisible;
  }
}

function testClickCandidateSummary(
  foundCount: number,
  visibleCount: number,
  enabledCount: number,
  visibleActionableCount: number,
  detail: string
): string {
  return `${foundCount} candidates found; ${visibleCount} visible; ${enabledCount} enabled; ${visibleActionableCount} visible/actionable; ${detail}.`;
}

function mergeControlAvailability(values: AttendanceControlAvailability[]): AttendanceControlAvailability {
  if (values.includes("available")) {
    return "available";
  }

  if (values.includes("unavailable")) {
    return "unavailable";
  }

  return "unknown";
}

function mergeTestClickTargetReason(results: TestClickTargetSnapshot[]): string {
  return results.find((result) => result.availability === "available")?.reason
    ?? results.find((result) => result.availability === "unavailable")?.reason
    ?? results[0]?.reason
    ?? "Test click target was not checked.";
}

function assertTestClickTarget(targetId: TestClickTargetId): void {
  if (targetId !== "a56" && targetId !== "a57") {
    throw new Error("Invalid manual test click target.");
  }
}

function assertAttendanceAction(action: AttendanceActionType): void {
  if (action !== "clock-in" && action !== "clock-out") {
    throw new Error("Invalid configured action.");
  }
}

function attendanceTargetId(action: AttendanceActionType): "a50" | "a51" {
  assertAttendanceAction(action);
  return action === "clock-in" ? "a50" : "a51";
}

function mergeControlReason(results: ControlProbeResult[]): string {
  return results.find((result) => result.availability === "available")?.reason
    ?? results.find((result) => result.availability === "unavailable")?.reason
    ?? results[0]?.reason
    ?? "Not checked.";
}

function unknownAttendanceControls(reason: string, checkedAt: string | null = null): AttendanceControlDetection {
  return {
    clockInAvailable: "unknown",
    clockOutAvailable: "unknown",
    clockInReason: reason,
    clockOutReason: reason,
    lastButtonCheckAt: checkedAt
  };
}

function attendanceControlsSignature(snapshot: Pick<
  PerakamStatusSnapshot,
  "clockInAvailable" | "clockOutAvailable" | "clockInReason" | "clockOutReason"
>): string {
  return [
    snapshot.clockInAvailable,
    snapshot.clockOutAvailable,
    snapshot.clockInReason,
    snapshot.clockOutReason
  ].join("|");
}
