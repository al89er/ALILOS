import { randomUUID } from "node:crypto";
import type { AppLogger } from "../main/logger";
import type {
  BrowserStatusSnapshot,
  PerakamStatusSnapshot,
  TestClickConfirmationRequest,
  TestClickDashboardSnapshot,
  TestClickDryRunResult,
  TestClickExecutionResult,
  TestClickReadinessResult,
  TestClickRejectionReason,
  TestClickResultStatus,
  TestClickSafetyCheckResult,
  TestClickTargetDiagnostics,
  TestClickTargetId,
  TestClickTargetSnapshot
} from "../shared/types";
import { emptyPerakamObservedValues } from "./perakam-observed-values";

const TEST_CLICK_CONFIRMATION_WINDOW_MS = 60 * 1000;
const TEST_CLICK_ALLOWED_PERAKAM_STATUSES = ["reachable", "likely-logged-in"] as const;

interface TestClickBrowserExecutionResult {
  targetId: TestClickTargetId;
  beforeUrl: string | null;
  afterUrl: string | null;
  targetAvailability: TestClickTargetSnapshot;
}

interface TestClickServiceSources {
  getBrowserStatus: () => BrowserStatusSnapshot;
  getPerakamStatus: () => PerakamStatusSnapshot;
  refreshPerakamStatus: () => Promise<PerakamStatusSnapshot>;
  getConfiguredPerakamUrl: () => string;
  detectTestClickTarget: (targetId: TestClickTargetId) => Promise<TestClickTargetSnapshot>;
  inspectTestClickTargets: () => Promise<TestClickTargetDiagnostics>;
  clickVisibleTestTarget: (targetId: TestClickTargetId) => Promise<TestClickBrowserExecutionResult>;
  broadcastSnapshot: () => void;
}

export class TestClickService {
  private readonly confirmations = new Map<string, TestClickConfirmationRequest>();
  private readonly dryRuns = new Map<string, TestClickDryRunResult>();
  private readonly executions = new Map<string, TestClickExecutionResult>();
  private readonly readiness = new Map<TestClickTargetId, TestClickReadinessResult>();
  private diagnostics: TestClickTargetDiagnostics | null = null;

  constructor(
    private readonly logger: AppLogger,
    private readonly sources: TestClickServiceSources
  ) {}

  snapshot(now = new Date()): TestClickDashboardSnapshot {
    this.expirePendingConfirmations(now);

    return {
      targets: {
        a56: this.readiness.get("a56") ?? null,
        a57: this.readiness.get("a57") ?? null
      },
      diagnostics: this.diagnostics,
      activeConfirmation: this.latestConfirmation(),
      latestDryRun: this.latestDryRun(),
      latestExecution: this.latestExecution()
    };
  }

  async checkReadiness(targetId: TestClickTargetId, now = new Date()): Promise<TestClickReadinessResult> {
    assertTestClickTarget(targetId);
    this.expirePendingConfirmations(now);
    const result = await this.evaluateReadiness(targetId, now);
    this.readiness.set(targetId, result);
    this.logger.info(`Manual test-click readiness checked for ${targetId}: ${result.ready ? "ready" : "not ready"}.`);
    return result;
  }

  async inspectTargets(): Promise<TestClickTargetDiagnostics> {
    this.diagnostics = await this.sources.inspectTestClickTargets();
    const a56Count = this.diagnostics.targets.a56.length;
    const a57Count = this.diagnostics.targets.a57.length;
    this.logger.info(`Manual test-click diagnostics inspected. a56 candidates: ${a56Count}; a57 candidates: ${a57Count}.`);
    return this.diagnostics;
  }

  async createConfirmation(targetId: TestClickTargetId, now = new Date()): Promise<TestClickConfirmationRequest | null> {
    const readiness = await this.checkReadiness(targetId, now);
    if (!readiness.ready) {
      this.logger.warn(`Manual test-click confirmation rejected for ${targetId}: ${readiness.reasonText}`);
      return null;
    }

    const existing = this.latestConfirmation(targetId);
    if (existing?.status === "pending") {
      return existing;
    }

    const request: TestClickConfirmationRequest = {
      id: randomUUID(),
      targetId,
      sanitizedUrl: readiness.perakamStatus.currentUrl,
      browserStatusAtCreation: readiness.browserStatus,
      perakamStatusAtCreation: readiness.perakamStatus,
      targetAvailabilityAtCreation: readiness.targetAvailability,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TEST_CLICK_CONFIRMATION_WINDOW_MS).toISOString(),
      status: "pending",
      claimedAt: null,
      usedAt: null,
      failedAt: null,
      failureReason: null
    };

    this.confirmations.set(request.id, request);
    this.logger.info(`Manual test-click confirmation offered for ${targetId}. ID: ${shortId(request.id)}.`);
    return request;
  }

  acceptConfirmation(id: string, now = new Date()): TestClickConfirmationRequest | null {
    this.expirePendingConfirmations(now);
    const request = this.confirmations.get(id);

    if (!request || request.status !== "pending") {
      this.logger.warn(`Manual test-click confirmation rejected due to stale state. ID: ${shortId(id)}.`);
      return null;
    }

    if (isExpired(request, now)) {
      request.status = "expired";
      this.logger.info(`Manual test-click confirmation expired for ${request.targetId}. ID: ${shortId(request.id)}.`);
      return request;
    }

    request.status = "accepted";
    this.logger.info(`Manual test-click confirmation accepted for ${request.targetId}. ID: ${shortId(request.id)}.`);
    return request;
  }

  cancelConfirmation(id: string): TestClickConfirmationRequest | null {
    const request = this.confirmations.get(id);

    if (!request || request.status !== "pending") {
      this.logger.warn(`Manual test-click confirmation rejected due to stale state. ID: ${shortId(id)}.`);
      return null;
    }

    request.status = "cancelled";
    this.logger.info(`Manual test-click confirmation cancelled for ${request.targetId}. ID: ${shortId(request.id)}.`);
    return request;
  }

  async runDryRun(id: string, now = new Date()): Promise<TestClickDryRunResult> {
    this.expirePendingConfirmations(now);
    this.logger.info(`Manual test-click dry-run requested. ID: ${shortId(id)}.`);

    let request: TestClickConfirmationRequest | null = null;
    let result: TestClickDryRunResult;

    try {
      request = this.confirmations.get(id) ?? null;
      const evaluation = request ? await this.evaluateExecutionSafety(request, now) : missingConfirmationEvaluation(now);
      result = buildDryRunResult(request, id, evaluation, now);
    } catch (error) {
      result = buildFailedDryRunResult(request, id, now, error);
    }

    this.dryRuns.set(id || result.confirmationId, result);
    this.logDryRunResult(result);
    return result;
  }

  async runManualTestClick(id: string, now = new Date()): Promise<TestClickExecutionResult> {
    this.expirePendingConfirmations(now);
    this.logger.info(`Manual test-click started. ID: ${shortId(id)}.`);

    let request: TestClickConfirmationRequest | null = null;
    let result: TestClickExecutionResult;
    let clickAttemptStarted = false;

    try {
      const claim = this.claimTestClickConfirmation(id, now);

      if (!claim.request || claim.rejectionReasons.length > 0) {
        result = buildClaimRejectedExecutionResult(id, claim.request, claim.rejectionReasons, now);
        this.executions.set(id || result.confirmationId, result);
        this.logExecutionResult(result);
        return result;
      }

      request = claim.request;
      const evaluation = await this.evaluateExecutionSafety(request, now, true);

      if (evaluation.rejectionReasons.length > 0) {
        this.releaseTestClickConfirmationClaim(request.id, evaluation.rejectionReasons.join(", ") || "safety-check-rejected", now);
        result = buildRejectedExecutionResult(request, id, evaluation, now);
      } else {
        clickAttemptStarted = true;
        const clickResult = await this.sources.clickVisibleTestTarget(request.targetId);
        this.markTestClickConfirmationUsed(request.id, now);
        result = {
          confirmationId: request.id,
          targetId: request.targetId,
          beforeUrl: clickResult.beforeUrl,
          afterUrl: clickResult.afterUrl,
          sanitizedPerakamUrl: clickResult.afterUrl,
          targetAvailability: clickResult.targetAvailability,
          safetyChecks: evaluation.checks,
          rejectionReasons: [],
          status: "succeeded",
          summary: "Manual test click completed once on the selected non-primary target.",
          createdAt: now.toISOString()
        };
      }
    } catch (error) {
      if (request?.status === "in-flight") {
        const message = sanitizeErrorMessage(error);
        if (clickAttemptStarted) {
          this.markTestClickConfirmationFailed(request.id, message, now);
        } else {
          this.releaseTestClickConfirmationClaim(request.id, message, now);
        }
      }
      result = buildFailedExecutionResult(request, id, now, error);
    }

    this.executions.set(id || result.confirmationId, result);
    this.logExecutionResult(result);
    return result;
  }

  private async evaluateReadiness(targetId: TestClickTargetId, now: Date): Promise<TestClickReadinessResult> {
    const browserStatus = this.sources.getBrowserStatus();
    const perakamStatus = await this.sources.refreshPerakamStatus();
    this.diagnostics = await this.sources.inspectTestClickTargets();
    const targetAvailability = await this.sources.detectTestClickTarget(targetId);
    const checks = buildSharedSafetyChecks({
      request: null,
      now,
      browserStatus,
      perakamStatus,
      targetAvailability,
      configuredPerakamUrl: this.sources.getConfiguredPerakamUrl(),
      requireAccepted: false
    });
    const reasons = uniqueRejectionReasons(checks.rejectionReasons);

    return {
      targetId,
      ready: reasons.length === 0,
      reasons,
      reasonText: reasons.length === 0 ? `${targetId} test click target is ready for manual confirmation.` : readinessReasonText(reasons),
      browserStatus,
      perakamStatus,
      targetAvailability,
      checkedAt: now.toISOString()
    };
  }

  private async evaluateExecutionSafety(
    request: TestClickConfirmationRequest,
    now: Date,
    allowClaimed = false
  ): Promise<{
    browserStatus: BrowserStatusSnapshot;
    perakamStatus: PerakamStatusSnapshot;
    targetAvailability: TestClickTargetSnapshot;
    checks: TestClickSafetyCheckResult[];
    rejectionReasons: TestClickRejectionReason[];
  }> {
    const browserStatus = this.sources.getBrowserStatus();
    const perakamStatus = await this.sources.refreshPerakamStatus();
    const targetAvailability = await this.sources.detectTestClickTarget(request.targetId);
    const result = buildSharedSafetyChecks({
      request,
      now,
      browserStatus,
      perakamStatus,
      targetAvailability,
      configuredPerakamUrl: this.sources.getConfiguredPerakamUrl(),
      requireAccepted: true,
      allowClaimed
    });

    return {
      browserStatus,
      perakamStatus,
      targetAvailability,
      checks: result.checks,
      rejectionReasons: uniqueRejectionReasons(result.rejectionReasons)
    };
  }

  private latestConfirmation(targetId?: TestClickTargetId): TestClickConfirmationRequest | null {
    const matches = [...this.confirmations.values()]
      .filter((request) => !targetId || request.targetId === targetId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return matches[0] ?? null;
  }

  private latestDryRun(): TestClickDryRunResult | null {
    const matches = [...this.dryRuns.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return matches[0] ?? null;
  }

  private latestExecution(): TestClickExecutionResult | null {
    const matches = [...this.executions.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return matches[0] ?? null;
  }

  private expirePendingConfirmations(now: Date): void {
    for (const request of this.confirmations.values()) {
      if (request.status !== "pending" || !isExpired(request, now)) {
        continue;
      }

      request.status = "expired";
      this.logger.info(`Manual test-click confirmation expired for ${request.targetId}. ID: ${shortId(request.id)}.`);
      this.sources.broadcastSnapshot();
    }
  }

  private claimTestClickConfirmation(id: string, now: Date): {
    request: TestClickConfirmationRequest | null;
    rejectionReasons: TestClickRejectionReason[];
  } {
    this.logger.info(`Manual test-click execution claim attempted. ID: ${shortId(id)}.`);
    const request = this.confirmations.get(id) ?? null;

    if (!request) {
      this.logger.warn(`Manual test-click execution claim rejected: missing confirmation. ID: ${shortId(id)}.`);
      return { request: null, rejectionReasons: ["missing-confirmation"] };
    }

    const rejectionReason = claimRejectionReason(request.status);
    if (rejectionReason && request.status !== "pending") {
      this.logger.warn(`Manual test-click execution claim rejected: ${request.status}. ID: ${shortId(request.id)}.`);
      return { request, rejectionReasons: [rejectionReason] };
    }

    if (isExpired(request, now)) {
      request.status = "expired";
      this.logger.warn(`Manual test-click execution claim rejected: expired confirmation. ID: ${shortId(request.id)}.`);
      return { request, rejectionReasons: ["confirmation-expired"] };
    }

    if (rejectionReason) {
      this.logger.warn(`Manual test-click execution claim rejected: ${request.status}. ID: ${shortId(request.id)}.`);
      return { request, rejectionReasons: [rejectionReason] };
    }

    request.status = "in-flight";
    request.claimedAt = now.toISOString();
    request.failureReason = null;
    this.logger.info(`Manual test-click execution claim accepted for ${request.targetId}. ID: ${shortId(request.id)}.`);
    return { request, rejectionReasons: [] };
  }

  private markTestClickConfirmationUsed(id: string, now: Date): void {
    const request = this.confirmations.get(id);
    if (!request) {
      return;
    }

    request.status = "used";
    request.usedAt = now.toISOString();
    this.logger.info(`Manual test-click execution finalized as used for ${request.targetId}. ID: ${shortId(request.id)}.`);
  }

  private markTestClickConfirmationFailed(id: string, reason: string, now: Date): void {
    const request = this.confirmations.get(id);
    if (!request) {
      return;
    }

    request.status = "failed";
    request.failedAt = now.toISOString();
    request.failureReason = reason;
    this.logger.warn(`Manual test-click execution finalized as failed for ${request.targetId}. ID: ${shortId(request.id)}. Reason: ${reason}.`);
  }

  private releaseTestClickConfirmationClaim(id: string, reason: string, now: Date): void {
    const request = this.confirmations.get(id);
    if (!request || request.status !== "in-flight") {
      return;
    }

    request.status = "accepted";
    request.failedAt = now.toISOString();
    request.failureReason = reason;
    this.logger.warn(`Manual test-click execution claim released for ${request.targetId}. ID: ${shortId(request.id)}. Reason: ${reason}.`);
  }

  private logDryRunResult(result: TestClickDryRunResult): void {
    if (result.status === "passed") {
      this.logger.info(`Manual test-click dry-run passed for ${result.targetId}. ID: ${shortId(result.confirmationId)}.`);
      return;
    }

    this.logger.warn(`Manual test-click dry-run rejected. ID: ${shortId(result.confirmationId)}. Reason: ${result.rejectionReasons.join(", ") || "unknown"}.`);
  }

  private logExecutionResult(result: TestClickExecutionResult): void {
    if (result.status === "succeeded") {
      this.logger.info(`Manual test-click succeeded for ${result.targetId}. ID: ${shortId(result.confirmationId)}.`);
      return;
    }

    this.logger.warn(`Manual test-click failed. ID: ${shortId(result.confirmationId)}. Reason: ${result.rejectionReasons.join(", ") || result.summary}.`);
  }
}

function buildSharedSafetyChecks(input: {
  request: TestClickConfirmationRequest | null;
  now: Date;
  browserStatus: BrowserStatusSnapshot;
  perakamStatus: PerakamStatusSnapshot;
  targetAvailability: TestClickTargetSnapshot;
  configuredPerakamUrl: string;
  requireAccepted: boolean;
  allowClaimed?: boolean;
}): { checks: TestClickSafetyCheckResult[]; rejectionReasons: TestClickRejectionReason[] } {
  const checks: TestClickSafetyCheckResult[] = [];
  const rejectionReasons: TestClickRejectionReason[] = [];
  const request = input.request;

  if (request) {
    addCheck(checks, rejectionReasons, "confirmation exists", true, "Confirmation exists.", "missing-confirmation");
    addCheck(checks, rejectionReasons, "target ID is allowed", isTestClickTarget(request.targetId), "Target is a permitted non-primary test target.", "invalid-target");
    addCheck(checks, rejectionReasons, "confirmation is not expired", !isExpired(request, input.now), "Confirmation has not expired.", "confirmation-expired");
    addCheck(checks, rejectionReasons, "confirmation is not already used", request.status !== "used", "Confirmation has not been used.", "confirmation-used");

    if (input.requireAccepted) {
      const statusIsExecutable = request.status === "accepted" || Boolean(input.allowClaimed && request.status === "in-flight");
      addCheck(checks, rejectionReasons, "confirmation status executable", statusIsExecutable, statusReason(request.status), statusRejectionReason(request.status));
    }

    addCheck(checks, rejectionReasons, "target matches confirmation", input.targetAvailability.targetId === request.targetId, "Target availability matches confirmation target.", "stale-confirmation");
  }

  addCheck(checks, rejectionReasons, "browser is running", input.browserStatus.state === "running", "Browser is running.", "browser-not-running");
  addCheck(checks, rejectionReasons, "Perakam page is open", Boolean(input.perakamStatus.currentUrl) && input.perakamStatus.status !== "not-opened", "Perakam page is open.", "perakam-not-opened");
  addCheck(checks, rejectionReasons, "Perakam is reachable", TEST_CLICK_ALLOWED_PERAKAM_STATUSES.includes(input.perakamStatus.status as typeof TEST_CLICK_ALLOWED_PERAKAM_STATUSES[number]), "Perakam page is reachable.", "perakam-not-reachable");
  addCheck(checks, rejectionReasons, "Perakam URL host matches config", Boolean(input.perakamStatus.currentUrl) && isSameHost(input.perakamStatus.currentUrl ?? "", input.configuredPerakamUrl), "Perakam URL is on configured host.", "perakam-url-mismatch");
  addCheck(checks, rejectionReasons, "browser has no unresolved error", !input.browserStatus.lastError, "No unresolved browser error.", "browser-error");
  addCheck(checks, rejectionReasons, "Perakam has no unresolved error", !input.perakamStatus.lastError, "No unresolved Perakam error.", "perakam-error");
  addCheck(checks, rejectionReasons, "selected test target is available", input.targetAvailability.availability === "available", input.targetAvailability.reason, "target-unavailable");

  return { checks, rejectionReasons };
}

function buildClaimRejectedExecutionResult(
  confirmationId: string,
  request: TestClickConfirmationRequest | null,
  rejectionReasons: TestClickRejectionReason[],
  now: Date
): TestClickExecutionResult {
  const reasons = uniqueRejectionReasons(rejectionReasons);

  return {
    confirmationId: request?.id ?? (confirmationId || "missing"),
    targetId: request?.targetId ?? null,
    beforeUrl: request?.sanitizedUrl ?? null,
    afterUrl: request?.sanitizedUrl ?? null,
    sanitizedPerakamUrl: request?.sanitizedUrl ?? null,
    targetAvailability: request?.targetAvailabilityAtCreation ?? null,
    safetyChecks: [
      safetyCheck("execution claim accepted", false, claimRejectionText(reasons[0] ?? "unknown"))
    ],
    rejectionReasons: reasons,
    status: "rejected",
    summary: `Manual test-click rejected before execution. Claim failed: ${claimRejectionText(reasons[0] ?? "unknown")}`,
    createdAt: now.toISOString()
  };
}

function missingConfirmationEvaluation(now: Date): {
  browserStatus: BrowserStatusSnapshot;
  perakamStatus: PerakamStatusSnapshot;
  targetAvailability: TestClickTargetSnapshot | null;
  checks: TestClickSafetyCheckResult[];
  rejectionReasons: TestClickRejectionReason[];
} {
  return {
    browserStatus: emptyBrowserStatus(),
    perakamStatus: emptyPerakamStatus(),
    targetAvailability: null,
    checks: [
      safetyCheck("confirmation exists", false, "Confirmation does not exist.")
    ],
    rejectionReasons: ["missing-confirmation"]
  };
}

function buildDryRunResult(
  request: TestClickConfirmationRequest | null,
  confirmationId: string,
  evaluation: {
    browserStatus: BrowserStatusSnapshot;
    perakamStatus: PerakamStatusSnapshot;
    targetAvailability: TestClickTargetSnapshot | null;
    checks: TestClickSafetyCheckResult[];
    rejectionReasons: TestClickRejectionReason[];
  },
  now: Date
): TestClickDryRunResult {
  const rejectionReasons = uniqueRejectionReasons(evaluation.rejectionReasons);
  const status: TestClickResultStatus = rejectionReasons.length > 0 ? "rejected" : "passed";

  return {
    confirmationId: request?.id ?? (confirmationId || "missing"),
    targetId: request?.targetId ?? null,
    sanitizedPerakamUrl: evaluation.perakamStatus.currentUrl,
    browserStatus: evaluation.browserStatus,
    perakamStatus: evaluation.perakamStatus,
    targetAvailability: evaluation.targetAvailability,
    safetyChecks: evaluation.checks,
    rejectionReasons,
    status,
    summary: status === "passed"
      ? "Manual test-click dry-run passed. One future guarded click on the selected non-primary target would be eligible."
      : `Manual test-click dry-run rejected. ${rejectionReasons.length} safety check(s) did not pass.`,
    createdAt: now.toISOString()
  };
}

function buildRejectedExecutionResult(
  request: TestClickConfirmationRequest | null,
  confirmationId: string,
  evaluation: {
    perakamStatus: PerakamStatusSnapshot;
    targetAvailability: TestClickTargetSnapshot | null;
    checks: TestClickSafetyCheckResult[];
    rejectionReasons: TestClickRejectionReason[];
  },
  now: Date
): TestClickExecutionResult {
  const rejectionReasons = uniqueRejectionReasons(evaluation.rejectionReasons);

  return {
    confirmationId: request?.id ?? (confirmationId || "missing"),
    targetId: request?.targetId ?? null,
    beforeUrl: evaluation.perakamStatus.currentUrl,
    afterUrl: evaluation.perakamStatus.currentUrl,
    sanitizedPerakamUrl: evaluation.perakamStatus.currentUrl,
    targetAvailability: evaluation.targetAvailability,
    safetyChecks: evaluation.checks,
    rejectionReasons,
    status: "rejected",
    summary: `Manual test-click rejected. ${rejectionReasons.length} safety check(s) did not pass.`,
    createdAt: now.toISOString()
  };
}

function buildFailedDryRunResult(
  request: TestClickConfirmationRequest | null,
  confirmationId: string,
  now: Date,
  error: unknown
): TestClickDryRunResult {
  const message = sanitizeErrorMessage(error);

  return {
    confirmationId: request?.id ?? (confirmationId || "missing"),
    targetId: request?.targetId ?? null,
    sanitizedPerakamUrl: request?.sanitizedUrl ?? null,
    browserStatus: request?.browserStatusAtCreation ?? emptyBrowserStatus(),
    perakamStatus: request?.perakamStatusAtCreation ?? emptyPerakamStatus(),
    targetAvailability: request?.targetAvailabilityAtCreation ?? null,
    safetyChecks: [safetyCheck("dry-run completed without unexpected error", false, message)],
    rejectionReasons: ["unknown"],
    status: "failed",
    summary: `Manual test-click dry-run failed unexpectedly: ${message}`,
    createdAt: now.toISOString()
  };
}

function buildFailedExecutionResult(
  request: TestClickConfirmationRequest | null,
  confirmationId: string,
  now: Date,
  error: unknown
): TestClickExecutionResult {
  const message = sanitizeErrorMessage(error);

  return {
    confirmationId: request?.id ?? (confirmationId || "missing"),
    targetId: request?.targetId ?? null,
    beforeUrl: request?.sanitizedUrl ?? null,
    afterUrl: request?.sanitizedUrl ?? null,
    sanitizedPerakamUrl: request?.sanitizedUrl ?? null,
    targetAvailability: request?.targetAvailabilityAtCreation ?? null,
    safetyChecks: [safetyCheck("manual test click completed without unexpected error", false, message)],
    rejectionReasons: ["unknown"],
    status: "failed",
    summary: `Manual test-click failed unexpectedly: ${message}`,
    createdAt: now.toISOString()
  };
}

function addCheck(
  checks: TestClickSafetyCheckResult[],
  rejectionReasons: TestClickRejectionReason[],
  name: string,
  passed: boolean,
  reason: string,
  rejectionReason: TestClickRejectionReason
): void {
  checks.push(safetyCheck(name, passed, reason));

  if (!passed) {
    rejectionReasons.push(rejectionReason);
  }
}

function safetyCheck(name: string, passed: boolean, reason: string): TestClickSafetyCheckResult {
  return { name, passed, reason };
}

function statusReason(status: TestClickConfirmationRequest["status"]): string {
  switch (status) {
    case "accepted":
      return "Confirmation is accepted.";
    case "in-flight":
      return "Confirmation is already claimed for execution.";
    case "pending":
      return "Confirmation is still pending.";
    case "cancelled":
      return "Confirmation was cancelled.";
    case "expired":
      return "Confirmation expired.";
    case "used":
      return "Confirmation was already used.";
    case "failed":
      return "Confirmation execution already failed.";
  }
}

function statusRejectionReason(status: TestClickConfirmationRequest["status"]): TestClickRejectionReason {
  switch (status) {
    case "accepted":
      return "unknown";
    case "in-flight":
      return "confirmation-in-flight";
    case "pending":
      return "confirmation-pending";
    case "cancelled":
      return "confirmation-cancelled";
    case "expired":
      return "confirmation-expired";
    case "used":
      return "confirmation-used";
    case "failed":
      return "confirmation-failed";
  }
}

function claimRejectionReason(status: TestClickConfirmationRequest["status"]): TestClickRejectionReason | null {
  switch (status) {
    case "accepted":
      return null;
    case "pending":
      return "confirmation-pending";
    case "in-flight":
      return "confirmation-in-flight";
    case "cancelled":
      return "confirmation-cancelled";
    case "expired":
      return "confirmation-expired";
    case "used":
      return "confirmation-used";
    case "failed":
      return "confirmation-failed";
  }
}

function claimRejectionText(reason: TestClickRejectionReason): string {
  switch (reason) {
    case "missing-confirmation":
      return "confirmation does not exist.";
    case "confirmation-pending":
      return "confirmation is still pending.";
    case "confirmation-cancelled":
      return "confirmation was cancelled.";
    case "confirmation-expired":
      return "confirmation expired.";
    case "confirmation-in-flight":
      return "confirmation is already in flight.";
    case "confirmation-used":
      return "confirmation was already used.";
    case "confirmation-failed":
      return "confirmation already failed.";
    default:
      return "confirmation could not be claimed.";
  }
}

function readinessReasonText(reasons: TestClickRejectionReason[]): string {
  if (reasons.includes("browser-not-running")) {
    return "Not ready: browser is not running.";
  }

  if (reasons.includes("perakam-not-opened")) {
    return "Not ready: Perakam dashboard is not opened.";
  }

  if (reasons.includes("perakam-not-reachable")) {
    return "Not ready: Perakam dashboard is not reachable.";
  }

  if (reasons.includes("perakam-url-mismatch")) {
    return "Not ready: Perakam page is not on the configured host.";
  }

  if (reasons.includes("browser-error") || reasons.includes("perakam-error")) {
    return "Not ready: browser or Perakam status has an unresolved error.";
  }

  if (reasons.includes("target-unavailable")) {
    return "Not ready: selected test click target is not visibly available.";
  }

  return "Not ready: manual test-click readiness could not be confirmed.";
}

function uniqueRejectionReasons(reasons: TestClickRejectionReason[]): TestClickRejectionReason[] {
  return [...new Set(reasons.filter((reason) => reason !== "unknown"))];
}

function isTestClickTarget(targetId: unknown): targetId is TestClickTargetId {
  return targetId === "a56" || targetId === "a57";
}

function assertTestClickTarget(targetId: unknown): asserts targetId is TestClickTargetId {
  if (!isTestClickTarget(targetId)) {
    throw new Error("Invalid manual test click target.");
  }
}

function isExpired(request: TestClickConfirmationRequest, now: Date): boolean {
  return new Date(request.expiresAt).getTime() <= now.getTime();
}

function isSameHost(currentUrl: string, configuredUrl: string): boolean {
  try {
    return new URL(currentUrl).host === new URL(configuredUrl).host;
  } catch {
    return false;
  }
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown manual test-click error.";
  return message.replace(/[?#][^\s]*/g, "?[redacted]").slice(0, 240);
}

function emptyBrowserStatus(): BrowserStatusSnapshot {
  return {
    state: "stopped",
    profilePath: "",
    lastStartedAt: null,
    lastStoppedAt: null,
    lastError: null
  };
}

function emptyPerakamStatus(): PerakamStatusSnapshot {
  return {
    status: "not-opened",
    dashboardUrl: "",
    legacyDashboardUrl: "",
    currentUrl: null,
    pageTitle: null,
    pageState: "not-opened",
    statusReason: "Perakam page is not open.",
    evidenceSnippets: [],
    lastNavigationAt: null,
    lastCheckedAt: null,
    clockInAvailable: "unknown",
    clockOutAvailable: "unknown",
    clockInReason: "Not checked.",
    clockOutReason: "Not checked.",
    lastButtonCheckAt: null,
    observedValues: emptyPerakamObservedValues(),
    lastError: null
  };
}

function shortId(id: string): string {
  return id.slice(0, 8);
}
