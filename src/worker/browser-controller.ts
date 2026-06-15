import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import type {
  AttendanceControlAvailability,
  BrowserControllerState,
  BrowserStatusSnapshot,
  PerakamPageStatus,
  PerakamStatusSnapshot
} from "../shared/types";
import type { AppLogger } from "../main/logger";

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

export class BrowserController {
  private context: BrowserContext | null = null;
  private perakamPage: Page | null = null;
  private state: BrowserControllerState = "stopped";
  private lastStartedAt: string | null = null;
  private lastStoppedAt: string | null = null;
  private lastError: string | null = null;
  private lastLoggedPerakamStatus: PerakamPageStatus | null = null;
  private lastLoggedAttendanceControlsSignature: string | null = null;
  private perakamStatus: PerakamStatusSnapshot = {
    status: "not-opened",
    dashboardUrl: "",
    legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
    currentUrl: null,
    pageTitle: null,
    lastNavigationAt: null,
    lastCheckedAt: null,
    ...unknownAttendanceControls("Not checked."),
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
    return { ...this.perakamStatus };
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
      const [title, readyState, bodyText] = await Promise.all([
        page.title().catch(() => ""),
        page.evaluate(() => document.readyState).catch(() => "unknown"),
        page.evaluate((maxLength) => document.body?.innerText.slice(0, maxLength) ?? "", MAX_BODY_TEXT_FOR_STATUS).catch(() => "")
      ]);
      const status = detectPerakamStatus(page.url(), title, bodyText, readyState);
      const buttonCheckAt = new Date().toISOString();
      const attendanceControls = readyState === "loading"
        ? unknownAttendanceControls("Page is still loading.", buttonCheckAt)
        : await detectAttendanceControls(page, buttonCheckAt);

      this.setPerakamSnapshot({
        status,
        dashboardUrl: displayUrl,
        legacyDashboardUrl: LEGACY_PERAKAM_DASHBOARD_URL,
        currentUrl: sanitizeUrlForDisplay(page.url()),
        pageTitle: title || null,
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
        lastNavigationAt: this.perakamStatus.lastNavigationAt,
        lastCheckedAt: checkedAt,
        ...unknownAttendanceControls("Button check unavailable because status detection failed.", checkedAt),
        lastError: message
      });
    }

    this.onStatusChanged();
    return this.getPerakamStatus(targetUrl);
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
      lastNavigationAt: this.perakamStatus.lastNavigationAt,
      lastCheckedAt: new Date().toISOString(),
      ...unknownAttendanceControls("Perakam page is not open."),
      lastError: null
    });
  }

  private currentPerakamUrl(): string | null {
    return this.perakamPage && !this.perakamPage.isClosed() ? sanitizeUrlForDisplay(this.perakamPage.url()) || null : null;
  }

  private setPerakamSnapshot(snapshot: PerakamStatusSnapshot): void {
    const previousStatus = this.perakamStatus.status;
    const previousControlsSignature = attendanceControlsSignature(this.perakamStatus);
    this.perakamStatus = snapshot;

    if (snapshot.status !== previousStatus || snapshot.status !== this.lastLoggedPerakamStatus) {
      this.logPerakamStatus(snapshot);
      this.lastLoggedPerakamStatus = snapshot.status;
    }

    const nextControlsSignature = attendanceControlsSignature(snapshot);
    if (
      snapshot.lastButtonCheckAt
      && nextControlsSignature !== previousControlsSignature
      && nextControlsSignature !== this.lastLoggedAttendanceControlsSignature
    ) {
      this.logger.info(
        `Perakam attendance controls: clock-in ${snapshot.clockInAvailable}; clock-out ${snapshot.clockOutAvailable}.`
      );
      this.lastLoggedAttendanceControlsSignature = nextControlsSignature;
    }
  }

  private logPerakamStatus(snapshot: PerakamStatusSnapshot): void {
    switch (snapshot.status) {
      case "reachable":
        this.logger.info("Perakam opened/reachable.");
        break;
      case "likely-login-required":
        this.logger.info("Perakam status: likely login required.");
        break;
      case "likely-logged-in":
        this.logger.info("Perakam status: likely logged in.");
        break;
      case "unknown":
        this.logger.warn("Perakam status: unknown.");
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
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown browser controller error.";
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed || DEFAULT_PERAKAM_DASHBOARD_URL;
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

function detectPerakamStatus(url: string, title: string, bodyText: string, readyState: string): PerakamPageStatus {
  if (readyState === "loading") {
    return "loading";
  }

  const combined = `${url}\n${title}\n${bodyText}`.toLowerCase();
  const isPerakamUrl = url.toLowerCase().includes("perakamwaktu3.upm.edu.my");
  const hasPageContent = title.trim().length > 0 || bodyText.trim().length > 0;

  if (!url || url === "about:blank") {
    return "not-opened";
  }

  if (hasAny(combined, ["log masuk", "id pengguna", "kata laluan", "katalaluan"]) || hasAny(combined, ["login", "password"])) {
    return "likely-login-required";
  }

  if (isPerakamUrl && hasAny(combined, ["perakam waktu", "dashboard"]) && hasAny(combined, ["profil", "rekod", "keluar", "logout"])) {
    return "likely-logged-in";
  }

  if (isPerakamUrl && hasPageContent) {
    return "reachable";
  }

  return "unknown";
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
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
    const candidates = uniqueElements([...idCandidates, ...labelCandidates]);

    if (candidates.length === 0) {
      return {
        availability: "unknown",
        reason: `${options.id} not found and no clear label fallback was found.`
      };
    }

    const probes = candidates.map((candidate) => {
      const source = idCandidates.includes(candidate) ? `${options.id} candidate` : "label fallback candidate";
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
      (probe) => probe.availability === "unavailable" && (!probe.visible || !probe.enabled)
    );

    if (available.length > 0) {
      const hasHiddenSidebar = probes.some((probe) => probe.hiddenSidebar);
      const hasDescendantTile = probes.some((probe) => probe.descendantVisible && probe.availability === "available");
      const detail = hasHiddenSidebar && dashboardAvailable.length > 0
        ? "hidden sidebar candidate ignored; visible dashboard candidate found"
        : hasDescendantTile
          ? "descendant tile visible; dashboard tile candidate found"
        : "visible/actionable candidate found";

      return {
        availability: "available",
        reason: candidateSummary(candidates.length, visible.length, enabled.length, visibleActionable.length, detail)
      };
    }

    if (hiddenOrDisabled.length === candidates.length) {
      return {
        availability: "unavailable",
        reason: candidateSummary(candidates.length, visible.length, enabled.length, visibleActionable.length, "all hidden or disabled")
      };
    }

    return {
      availability: "unknown",
      reason: candidateSummary(candidates.length, visible.length, enabled.length, visibleActionable.length, "availability is uncertain")
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

    if (!visible) {
      return {
        availability: "unavailable",
        reason: `${source}; ${visibility.reason}.`,
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
        reason: `${source}; element is disabled.`,
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
        reason: `${source}; element is visible but not clearly actionable.`,
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
      reason: `${source}; element is visible and enabled.`,
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
    const descendantVisible = hasVisibleMeaningfulDescendant(element);

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
        reason: "descendant tile visible",
        hiddenSidebar,
        dashboardCandidate: true,
        descendantVisible
      };
    }

    return {
      visible: false,
      reason: hiddenSidebar ? "hidden sidebar menu candidate" : "candidate and meaningful descendants have zero bounding box",
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

  function hasVisibleMeaningfulDescendant(element: HTMLElement): boolean {
    return Array.from(element.querySelectorAll<HTMLElement>(".tile-stats, .animated, div, h3, .count"))
      .slice(0, 20)
      .some((descendant) => isElementBoxVisible(descendant));
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

    return element.getAttribute("role") === "button";
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

function mergeControlAvailability(values: AttendanceControlAvailability[]): AttendanceControlAvailability {
  if (values.includes("available")) {
    return "available";
  }

  if (values.includes("unavailable")) {
    return "unavailable";
  }

  return "unknown";
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
