import { promises as dns } from "node:dns";
import { Notification } from "electron";
import type {
  AppConfig,
  CaptivePortalConfidence,
  CaptivePortalSnapshot,
  NetworkConnectivityState,
  NetworkMonitorSettings,
  NetworkMonitorSnapshot,
  PerakamReachabilityState
} from "../shared/types";
import type { ConfigStore } from "../main/config-store";
import type { AppLogger } from "../main/logger";
import type { TelegramService } from "../main/telegram-service";

const MIN_INTERVAL_SECONDS = 30;
const DEFAULT_TIMEOUT_MS = 7000;
const BODY_SAMPLE_LIMIT = 12000;
const TEXT_SNIPPET_LIMIT = 240;
const EMPTY_CAPTIVE_PORTAL: CaptivePortalSnapshot = {
  state: "not-detected",
  detectedAt: null,
  portalUrl: null,
  portalHost: null,
  evidence: [],
  confidence: "low",
  lastProbeUrl: null,
  redirectedFrom: null,
  redirectedTo: null,
  httpStatus: null,
  sanitizedTitle: null,
  sanitizedTextSnippet: null
};

interface ConnectivityCheckResult {
  state: NetworkConnectivityState;
  reason: string;
  error: string | null;
  captivePortal: CaptivePortalSnapshot;
}

interface PerakamCheckResult {
  state: PerakamReachabilityState;
  reason: string;
  error: string | null;
}

interface ProbeResult {
  ok: boolean;
  captivePortal: CaptivePortalSnapshot | null;
  reason: string;
  error: string | null;
}

export class NetworkMonitor {
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private checkedAt: string | null = null;
  private connectivityState: NetworkConnectivityState = "unknown";
  private perakamReachabilityState: PerakamReachabilityState = "unknown";
  private internetCheckReason = "Network monitor has not checked yet.";
  private perakamCheckReason = "Perakam reachability has not checked yet.";
  private lastSuccessfulInternetAt: string | null = null;
  private lastSuccessfulPerakamAt: string | null = null;
  private consecutiveFailures = 0;
  private sanitizedError: string | null = null;
  private captivePortal: CaptivePortalSnapshot = { ...EMPTY_CAPTIVE_PORTAL };
  private lastLoggedConnectivityState: NetworkConnectivityState | null = null;
  private lastLoggedPerakamState: PerakamReachabilityState | null = null;
  private lastLoggedCaptivePortalState: CaptivePortalSnapshot["state"] | null = null;
  private internetIncidentNotified = false;
  private perakamIncidentNotified = false;
  private captivePortalIncidentNotified = false;

  constructor(
    private readonly config: AppConfig,
    private readonly configStore: ConfigStore,
    private readonly logger: AppLogger,
    private readonly telegramService: TelegramService,
    private readonly broadcastSnapshot: () => void
  ) {}

  start(): void {
    if (this.timer || !this.config.networkMonitor.enabled) {
      return;
    }

    this.logger.info("Network monitor started.");
    this.timer = setInterval(() => {
      void this.checkNow("interval");
    }, this.intervalMs());
    void this.checkNow("startup");
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    this.logger.info("Network monitor stopped.");
  }

  configure(): void {
    this.config.networkMonitor = normalizeNetworkMonitorSettings(this.config.networkMonitor);
    this.configStore.save(this.config);
    this.stop();

    if (this.config.networkMonitor.enabled) {
      this.start();
    } else {
      this.broadcastSnapshot();
    }
  }

  snapshot(): NetworkMonitorSnapshot {
    return {
      enabled: this.config.networkMonitor.enabled,
      active: Boolean(this.timer),
      checkedAt: this.checkedAt,
      connectivityState: this.inFlight ? "checking" : this.connectivityState,
      perakamReachabilityState: this.inFlight ? "checking" : this.perakamReachabilityState,
      internetCheckReason: this.internetCheckReason,
      perakamCheckReason: this.perakamCheckReason,
      lastSuccessfulInternetAt: this.lastSuccessfulInternetAt,
      lastSuccessfulPerakamAt: this.lastSuccessfulPerakamAt,
      consecutiveFailures: this.consecutiveFailures,
      sanitizedError: this.sanitizedError,
      captivePortal: { ...this.captivePortal, evidence: [...this.captivePortal.evidence] },
      isNotifyOnly: true,
      settings: { ...this.config.networkMonitor }
    };
  }

  detectedPortalUrl(): string | null {
    return this.captivePortal.portalUrl;
  }

  async checkNow(source = "manual"): Promise<NetworkMonitorSnapshot> {
    if (this.inFlight) {
      return this.snapshot();
    }

    this.inFlight = true;
    this.checkedAt = new Date().toISOString();
    this.broadcastSnapshot();

    try {
      const [internet, perakam] = await Promise.all([
        checkConnectivity(this.config.networkMonitor.captivePortalDetectionEnabled),
        checkPerakamReachability(this.config.perakam.dashboardUrl)
      ]);
      this.applyResults(internet, perakam, source);
    } catch (error) {
      const message = sanitizeError(error);
      this.connectivityState = "error";
      this.perakamReachabilityState = "error";
      this.internetCheckReason = "Network monitor check failed.";
      this.perakamCheckReason = "Perakam reachability check failed.";
      this.sanitizedError = message;
      this.consecutiveFailures += 1;
      this.logger.warn(`Network monitor check failed: ${message}`);
      await this.evaluateNotifications();
    } finally {
      this.inFlight = false;
      this.broadcastSnapshot();
    }

    return this.snapshot();
  }

  private applyResults(internet: ConnectivityCheckResult, perakam: PerakamCheckResult, source: string): void {
    const now = this.checkedAt ?? new Date().toISOString();
    this.connectivityState = internet.state;
    this.perakamReachabilityState = perakam.state;
    this.internetCheckReason = internet.reason;
    this.perakamCheckReason = perakam.reason;
    this.sanitizedError = internet.error ?? perakam.error;
    this.captivePortal = retainOrClearCaptivePortalSnapshot(
      internet.captivePortal,
      this.captivePortal,
      this.config.networkMonitor.retainPortalEvidenceMinutes
    );

    if (isInternetHealthy(internet.state)) {
      this.lastSuccessfulInternetAt = now;
    }

    if (isPerakamHealthy(perakam.state)) {
      this.lastSuccessfulPerakamAt = now;
    }

    if (isInternetUnhealthy(internet.state) || isPerakamUnhealthy(perakam.state)) {
      this.consecutiveFailures += 1;
    } else {
      this.consecutiveFailures = 0;
    }

    this.logStateChanges(source);
    void this.evaluateNotifications();
  }

  private logStateChanges(source: string): void {
    if (this.connectivityState !== this.lastLoggedConnectivityState) {
      this.logger.info(`Network monitor internet state changed to ${this.connectivityState} from ${source}. ${this.internetCheckReason}`);
      this.lastLoggedConnectivityState = this.connectivityState;
    }

    if (this.perakamReachabilityState !== this.lastLoggedPerakamState) {
      this.logger.info(`Network monitor Perakam state changed to ${this.perakamReachabilityState} from ${source}. ${this.perakamCheckReason}`);
      this.lastLoggedPerakamState = this.perakamReachabilityState;
    }

    if (this.captivePortal.state !== this.lastLoggedCaptivePortalState) {
      this.logger.info(`Captive portal state changed to ${this.captivePortal.state}. Host: ${this.captivePortal.portalHost ?? "none"}. Evidence: ${this.captivePortal.evidence.join("; ") || "none"}.`);
      this.lastLoggedCaptivePortalState = this.captivePortal.state;
    }
  }

  private async evaluateNotifications(): Promise<void> {
    const settings = this.config.networkMonitor;

    if (settings.notifyOnInternetDown && isInternetUnhealthy(this.connectivityState) && this.consecutiveFailures >= settings.failureThreshold && !this.internetIncidentNotified) {
      this.internetIncidentNotified = true;
      await this.notify(internetDownTitle(this.connectivityState), internetDownMessage(this.connectivityState));
    }

    if (settings.notifyOnInternetDown && isCaptivePortalActive(this.captivePortal) && this.consecutiveFailures >= settings.failureThreshold && !this.captivePortalIncidentNotified) {
      this.captivePortalIncidentNotified = true;
      await this.notify(captivePortalTitle(this.captivePortal), captivePortalMessage(this.captivePortal));
    }

    if (settings.notifyOnPerakamDown && isPerakamUnhealthy(this.perakamReachabilityState) && this.consecutiveFailures >= settings.failureThreshold && !this.perakamIncidentNotified) {
      this.perakamIncidentNotified = true;
      await this.notify("A.L.I.L.O.S.: Perakam Waktu appears unreachable.", this.perakamCheckReason);
    }

    if (settings.notifyOnRecovery && this.internetIncidentNotified && isInternetHealthy(this.connectivityState)) {
      this.internetIncidentNotified = false;
      await this.notify("A.L.I.L.O.S.: Internet connection recovered.", this.internetCheckReason);
    }

    if (settings.notifyOnRecovery && this.captivePortalIncidentNotified && this.captivePortal.state === "not-detected" && isInternetHealthy(this.connectivityState)) {
      this.captivePortalIncidentNotified = false;
      await this.notify("A.L.I.L.O.S.: Captive portal cleared. Internet connection recovered.", this.internetCheckReason);
    }

    if (settings.notifyOnRecovery && this.perakamIncidentNotified && isPerakamHealthy(this.perakamReachabilityState)) {
      this.perakamIncidentNotified = false;
      await this.notify("A.L.I.L.O.S.: Perakam Waktu reachable again.", this.perakamCheckReason);
    }
  }

  private async notify(title: string, body: string): Promise<void> {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }

    const telegramResult = await this.telegramService.sendNotification(`${title}\n${body}`);
    if (!telegramResult.ok && !telegramResult.message.includes("Telegram is disabled")) {
      this.logger.warn(`Network monitor Telegram notification failed: ${telegramResult.message}`);
    }

    this.logger.info(`Network monitor notification sent: ${title}`);
  }

  private intervalMs(): number {
    return clampIntervalSeconds(this.config.networkMonitor.intervalSeconds) * 1000;
  }
}

export function normalizeNetworkMonitorSettings(settings: Partial<NetworkMonitorSettings> | null | undefined): NetworkMonitorSettings {
  return {
    enabled: Boolean(settings?.enabled),
    intervalSeconds: clampIntervalSeconds(settings?.intervalSeconds),
    notifyOnInternetDown: settings?.notifyOnInternetDown !== false,
    notifyOnPerakamDown: settings?.notifyOnPerakamDown !== false,
    notifyOnRecovery: settings?.notifyOnRecovery !== false,
    failureThreshold: clampNumber(settings?.failureThreshold, 1, 20, 2),
    captivePortalDetectionEnabled: settings?.captivePortalDetectionEnabled !== false,
    openDetectedPortalIn: settings?.openDetectedPortalIn === "playwright" ? "playwright" : "external",
    retainPortalEvidenceMinutes: clampNumber(settings?.retainPortalEvidenceMinutes, 5, 24 * 60, 120)
  };
}

async function checkConnectivity(captivePortalDetectionEnabled: boolean): Promise<ConnectivityCheckResult> {
  const probes = await Promise.all([
    probeInternetEndpoint("https://www.gstatic.com/generate_204", 204),
    probeInternetEndpoint("http://connectivitycheck.gstatic.com/generate_204", 204),
    probeInternetEndpoint("https://www.cloudflare.com/cdn-cgi/trace")
  ]);
  const successful = probes.find((probe) => probe.ok);

  if (successful) {
    return {
      state: "online",
      reason: successful.reason,
      error: null,
      captivePortal: { ...EMPTY_CAPTIVE_PORTAL }
    };
  }

  const captive = captivePortalDetectionEnabled ? bestCaptivePortalSnapshot(probes) : null;
  if (captive) {
    return {
      state: captive.state === "detected" ? "captive-portal-detected" : "captive-portal-suspected",
      reason: captive.state === "detected"
        ? `Captive portal detected at ${captive.portalHost ?? "unknown host"}.`
        : "Captive portal suspected from passive internet probes.",
      error: firstError(probes),
      captivePortal: captive
    };
  }

  const dnsWorks = await dns.resolve("cloudflare.com").then(() => true).catch(() => false);
  if (dnsWorks) {
    return {
      state: "local-network-only",
      reason: "DNS resolved, but public HTTPS probes did not succeed.",
      error: firstError(probes),
      captivePortal: { ...EMPTY_CAPTIVE_PORTAL }
    };
  }

  return {
    state: "offline",
    reason: "Public HTTPS probes and DNS lookup failed.",
    error: firstError(probes),
    captivePortal: { ...EMPTY_CAPTIVE_PORTAL }
  };
}

async function probeInternetEndpoint(url: string, expectedStatus?: number): Promise<ProbeResult> {
  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
    const location = response.headers.get("location") ?? "";
    const redirectedTo = location ? sanitizePortalUrl(new URL(location, url).toString()) : sanitizePortalUrl(response.url);
    const contentType = response.headers.get("content-type") ?? "";
    const shouldSample = response.status !== expectedStatus || contentType.toLowerCase().includes("html") || Boolean(location);
    const sample = shouldSample ? await readBodySample(response.clone(), BODY_SAMPLE_LIMIT).catch(() => "") : "";
    const captivePortal = buildCaptivePortalSnapshot({
      probeUrl: url,
      redirectedTo,
      status: response.status,
      contentType,
      sample
    });

    if (expectedStatus && response.status === expectedStatus) {
      return {
        ok: true,
        captivePortal: null,
        reason: `${hostLabel(url)} returned expected HTTP ${response.status}.`,
        error: null
      };
    }

    if (!expectedStatus && response.ok) {
      return {
        ok: true,
        captivePortal: null,
        reason: `${hostLabel(url)} returned HTTP ${response.status}.`,
        error: null
      };
    }

    if (captivePortal) {
      return {
        ok: false,
        captivePortal,
        reason: captivePortal.state === "detected" ? "Captive portal detected from internet probe response." : "Possible captive portal detected from internet probe response.",
        error: null
      };
    }

    return {
      ok: false,
      captivePortal: null,
      reason: `${hostLabel(url)} returned HTTP ${response.status}.`,
      error: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      captivePortal: null,
      reason: `${hostLabel(url)} check failed.`,
      error: sanitizeError(error)
    };
  }
}

async function checkPerakamReachability(dashboardUrl: string): Promise<PerakamCheckResult> {
  const loginUrl = buildPerakamLoginUrl(dashboardUrl);

  try {
    const response = await fetchWithTimeout(loginUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "Cache-Control": "no-cache"
      }
    });

    if (!response.ok && response.status >= 500) {
      return {
        state: "unreachable",
        reason: `Perakam returned HTTP ${response.status}.`,
        error: `HTTP ${response.status}`
      };
    }

    const sample = await readBodySample(response, BODY_SAMPLE_LIMIT);
    const state = classifyPerakamSample(response.url || loginUrl, sample, response.status);

    return {
      state,
      reason: perakamReason(state, response.status),
      error: null
    };
  } catch (error) {
    return {
      state: "unreachable",
      reason: "Perakam passive reachability check failed.",
      error: sanitizeError(error)
    };
  }
}

function classifyPerakamSample(url: string, sample: string, status: number): PerakamReachabilityState {
  const combined = `${url}\n${sample}`.toLowerCase();

  if (hasAny(combined, ["no user informations", "sorry! we couldn't find this user's record", "go to login page", "info pengguna"])) {
    return "stale-session";
  }

  if (hasAny(combined, ["frmchklogin", "log masuk", "e-perakam waktu online", "login.do"])) {
    return "login-required";
  }

  if (hasAny(combined, ["masa hadir", "masa keluar", "klik masuk", "klik keluar", "kad perakam", "senarai kehadiran"])) {
    return "dashboard";
  }

  if (status >= 200 && status < 500) {
    return "reachable";
  }

  return "unknown";
}

function perakamReason(state: PerakamReachabilityState, status: number): string {
  switch (state) {
    case "login-required":
      return `Perakam reachable; login page markers detected. HTTP ${status}.`;
    case "stale-session":
      return `Perakam reachable; stale-session markers detected. HTTP ${status}.`;
    case "dashboard":
      return `Perakam reachable; dashboard markers detected. HTTP ${status}.`;
    case "reachable":
      return `Perakam reachable over HTTPS. HTTP ${status}.`;
    default:
      return `Perakam passive check state: ${state}. HTTP ${status}.`;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBodySample(response: Response, limit: number): Promise<string> {
  const body = response.body;

  if (!body) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done || !value) {
        break;
      }

      const next = value.slice(0, Math.max(0, limit - total));
      chunks.push(next);
      total += next.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isInternetHealthy(state: NetworkConnectivityState): boolean {
  return state === "online";
}

function isInternetUnhealthy(state: NetworkConnectivityState): boolean {
  return state === "offline" || state === "local-network-only" || state === "captive-portal-suspected" || state === "captive-portal-detected" || state === "error";
}

function isPerakamHealthy(state: PerakamReachabilityState): boolean {
  return state === "reachable" || state === "login-required" || state === "stale-session" || state === "dashboard";
}

function isPerakamUnhealthy(state: PerakamReachabilityState): boolean {
  return state === "unreachable" || state === "error";
}

function internetDownTitle(state: NetworkConnectivityState): string {
  return state === "captive-portal-suspected" || state === "captive-portal-detected"
    ? "A.L.I.L.O.S.: Captive portal suspected."
    : "A.L.I.L.O.S.: Internet appears offline.";
}

function internetDownMessage(state: NetworkConnectivityState): string {
  return state === "captive-portal-suspected" || state === "captive-portal-detected"
    ? "Manual network login may be required."
    : "Network monitor could not confirm public internet access.";
}

function isCaptivePortalActive(snapshot: CaptivePortalSnapshot): boolean {
  return snapshot.state === "suspected" || snapshot.state === "detected";
}

function captivePortalTitle(snapshot: CaptivePortalSnapshot): string {
  return snapshot.state === "detected"
    ? `A.L.I.L.O.S.: Captive portal detected${snapshot.portalHost ? `: ${snapshot.portalHost}` : ""}.`
    : "A.L.I.L.O.S.: Captive portal suspected.";
}

function captivePortalMessage(snapshot: CaptivePortalSnapshot): string {
  return snapshot.portalHost
    ? `Manual network login may be required. Host: ${snapshot.portalHost}.`
    : "Manual network login may be required.";
}

function retainOrClearCaptivePortalSnapshot(
  next: CaptivePortalSnapshot,
  previous: CaptivePortalSnapshot,
  retainMinutes: number
): CaptivePortalSnapshot {
  if (next.state !== "not-detected") {
    return next;
  }

  if (!previous.detectedAt || previous.state === "not-detected") {
    return next;
  }

  const retainMs = clampNumber(retainMinutes, 5, 24 * 60, 120) * 60 * 1000;
  if (Date.now() - new Date(previous.detectedAt).getTime() <= retainMs) {
    return {
      ...previous,
      state: "not-detected"
    };
  }

  return next;
}

function bestCaptivePortalSnapshot(probes: ProbeResult[]): CaptivePortalSnapshot | null {
  const snapshots = probes
    .map((probe) => probe.captivePortal)
    .filter((snapshot): snapshot is CaptivePortalSnapshot => Boolean(snapshot));

  if (snapshots.length === 0) {
    return null;
  }

  return snapshots.sort((left, right) => confidenceRank(right.confidence) - confidenceRank(left.confidence))[0];
}

function buildCaptivePortalSnapshot(input: {
  probeUrl: string;
  redirectedTo: string | null;
  status: number;
  contentType: string;
  sample: string;
}): CaptivePortalSnapshot | null {
  const evidence: string[] = [];
  const redirectedFrom = sanitizePortalUrl(input.probeUrl);
  const redirectedTo = input.redirectedTo;
  const redirectedHost = redirectedTo ? hostLabel(redirectedTo) : null;
  const expectedHost = hostLabel(input.probeUrl);
  const text = input.sample.toLowerCase();
  const title = extractTitle(input.sample);
  const textSnippet = sanitizedTextSnippet(input.sample);
  const loginWords = ["login", "sign in", "username", "password", "captive", "portal", "authentication", "terms", "internet access", "access denied", "welcome"];
  const loginWordMatches = loginWords.filter((word) => text.includes(word));
  const unexpectedRedirect = Boolean(redirectedTo && redirectedHost && redirectedHost !== expectedHost);
  const gatewayHost = Boolean(redirectedHost && looksLikePortalHost(redirectedHost));
  const htmlResponse = input.contentType.toLowerCase().includes("html") || /<html|<form|<title/i.test(input.sample);

  if (unexpectedRedirect) {
    evidence.push("unexpected redirect");
  }

  if (gatewayHost) {
    evidence.push("gateway-like portal host");
  }

  if (htmlResponse) {
    evidence.push("HTML response from probe");
  }

  if (loginWordMatches.length > 0) {
    evidence.push(`login-like words: ${loginWordMatches.slice(0, 4).join(", ")}`);
  }

  if (input.status >= 300 && input.status < 400) {
    evidence.push(`redirect status HTTP ${input.status}`);
  } else if (input.status >= 200 && input.status < 300 && htmlResponse) {
    evidence.push(`unexpected HTTP ${input.status} HTML`);
  }

  if (evidence.length === 0) {
    return null;
  }

  const confidence = portalConfidence({
    unexpectedRedirect,
    gatewayHost,
    htmlResponse,
    loginWordCount: loginWordMatches.length
  });

  return {
    state: confidence === "high" ? "detected" : "suspected",
    detectedAt: new Date().toISOString(),
    portalUrl: redirectedTo,
    portalHost: redirectedHost,
    evidence: evidence.slice(0, 8),
    confidence,
    lastProbeUrl: redirectedFrom,
    redirectedFrom,
    redirectedTo,
    httpStatus: input.status,
    sanitizedTitle: title,
    sanitizedTextSnippet: textSnippet
  };
}

function portalConfidence(input: {
  unexpectedRedirect: boolean;
  gatewayHost: boolean;
  htmlResponse: boolean;
  loginWordCount: number;
}): CaptivePortalConfidence {
  if (input.unexpectedRedirect && input.htmlResponse && input.loginWordCount > 0) {
    return "high";
  }

  if (input.gatewayHost && (input.htmlResponse || input.loginWordCount > 0)) {
    return "high";
  }

  if (input.unexpectedRedirect || (input.htmlResponse && input.loginWordCount > 0)) {
    return "medium";
  }

  return "low";
}

function confidenceRank(confidence: CaptivePortalConfidence): number {
  switch (confidence) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function firstError(probes: ProbeResult[]): string | null {
  return probes.find((probe) => probe.error)?.error ?? null;
}

function buildPerakamLoginUrl(dashboardUrl: string): string {
  try {
    return new URL("login.do", dashboardUrl).toString();
  } catch {
    return "https://perakamwaktu3.upm.edu.my/login.do";
  }
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "internet endpoint";
  }
}

function sanitizePortalUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";

    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function looksLikePortalHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized.includes("login")
    || normalized.includes("portal")
    || normalized.includes("captive")
    || normalized.includes("hotspot")
    || normalized.includes("gateway")
    || normalized.startsWith("192.168.")
    || normalized.startsWith("10.")
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function extractTitle(sample: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(sample);
  return match ? sanitizedTextSnippet(match[1]) : null;
}

function sanitizedTextSnippet(sample: string): string | null {
  const withoutTags = sample.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const snippet = boundedText(withoutTags, TEXT_SNIPPET_LIMIT);
  return snippet || null;
}

function boundedText(value: string, limit: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function isCaptivePortalRedirect(location: string): boolean {
  if (!location) {
    return false;
  }

  const normalized = location.toLowerCase();
  return normalized.includes("login")
    || normalized.includes("portal")
    || normalized.includes("captive")
    || normalized.includes("hotspot")
    || normalized.includes("192.168.")
    || normalized.includes("10.")
    || normalized.includes("172.16.");
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function clampIntervalSeconds(value: unknown): number {
  return clampNumber(value, MIN_INTERVAL_SECONDS, 24 * 60 * 60, 60);
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function sanitizeError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? "Unknown error.");
  return raw
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .slice(0, 240);
}
