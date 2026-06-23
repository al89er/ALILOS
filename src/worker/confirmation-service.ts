import { randomUUID } from "node:crypto";
import type { AppLogger } from "../main/logger";
import type {
  AttendanceActionType,
  AttendanceCompletionRecord,
  AttendanceControlSnapshot,
  AttendanceExecutionResult,
  AttendanceVerificationResult,
  BrowserStatusSnapshot,
  ConfirmationDashboardSnapshot,
  ConfirmationRequest,
  DryRunExecutionResult,
  DryRunRejectionReason,
  DryRunSafetyCheckResult,
  NotReadyReason,
  PerakamAutoLoginSnapshot,
  PerakamObservedValuesSnapshot,
  PerakamStatusSnapshot,
  ReadinessSnapshot,
  ScheduleActionSnapshot,
  ScheduleActionStatus,
  ScheduleSnapshot
} from "../shared/types";
import { observedValueForAction } from "./perakam-observed-values";

const CONFIRMATION_WINDOW_MS = 60 * 1000;
const READY_STATUSES: ScheduleActionStatus[] = ["due-now", "within-grace-period"];

interface ConfirmationServiceSources {
  getScheduleSnapshot: () => ScheduleSnapshot;
  getBrowserStatus: () => BrowserStatusSnapshot;
  getPerakamStatus: () => PerakamStatusSnapshot;
  refreshPerakamStatus: () => Promise<PerakamStatusSnapshot>;
  refreshObservedPerakamValues: () => Promise<PerakamObservedValuesSnapshot>;
  getConfiguredPerakamUrl: () => string;
  getPerakamAutoLoginSnapshot: () => PerakamAutoLoginSnapshot;
  clickVisibleAttendanceControl: (action: AttendanceActionType) => Promise<AttendanceBrowserExecutionResult>;
  verifyAttendanceAfterClick: (
    action: AttendanceActionType,
    dateKey: string,
    localClickResult: AttendanceVerificationResult["localClickResult"],
    observedBefore: PerakamObservedValuesSnapshot | null
  ) => Promise<AttendanceVerificationResult>;
  persistCompletion: (record: AttendanceCompletionRecord) => void;
  broadcastSnapshot: () => void;
}

interface AttendanceBrowserExecutionResult {
  action: AttendanceActionType;
  mappedTargetId: "a50" | "a51";
  beforeUrl: string | null;
  afterUrl: string | null;
  controlAvailability: AttendanceControlSnapshot;
}

export class ConfirmationService {
  private readonly confirmations = new Map<string, ConfirmationRequest>();
  private readonly dryRuns = new Map<string, DryRunExecutionResult>();
  private readonly executions = new Map<string, AttendanceExecutionResult>();
  private readonly completedActions = new Map<string, AttendanceCompletionRecord>();

  constructor(
    private readonly logger: AppLogger,
    private readonly sources: ConfirmationServiceSources,
    initialCompletions: AttendanceCompletionRecord[] = []
  ) {
    for (const record of initialCompletions) {
      this.completedActions.set(completedKey(record.dateKey, record.action), record);
    }
  }

  snapshot(now = new Date()): ConfirmationDashboardSnapshot {
    this.expirePendingConfirmations(now);

    return {
      clockIn: this.evaluateReadiness("clock-in", now),
      clockOut: this.evaluateReadiness("clock-out", now)
    };
  }

  createConfirmation(action: AttendanceActionType, now = new Date()): ConfirmationRequest | null {
    this.expirePendingConfirmations(now);

    const readiness = this.evaluateReadiness(action, now);
    if (!readiness.ready) {
      this.logger.warn(`Confirmation rejected due to stale state for ${action} on ${readiness.dateKey}: ${readiness.reasonText}`);
      return null;
    }

    const existing = readiness.activeConfirmation;
    if (existing?.status === "pending") {
      return existing;
    }

    const request: ConfirmationRequest = {
      id: randomUUID(),
      dateKey: readiness.dateKey,
      action,
      generatedScheduleTime: readiness.generatedScheduleTime,
      schedulerStatusAtCreation: readiness.schedulerStatus,
      perakamStatusAtCreation: readinessControlSafePerakamSnapshot(this.sources.getPerakamStatus()),
      sanitizedUrl: this.sources.getPerakamStatus().currentUrl,
      controlAvailabilityAtCreation: readiness.controlAvailability,
      createdAt: now.toISOString(),
      expiresAt: calculateExpiresAt(readiness, this.sources.getScheduleSnapshot().gracePeriodMinutes, now).toISOString(),
      status: "pending",
      claimedAt: null,
      usedAt: null,
      failedAt: null,
      failureReason: null
    };

    this.confirmations.set(request.id, request);
    this.logger.info(`Confirmation offered for ${action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);
    return request;
  }

  acceptConfirmation(id: string, now = new Date()): ConfirmationRequest | null {
    this.expirePendingConfirmations(now);

    const request = this.confirmations.get(id);
    if (!request || request.status !== "pending") {
      this.logger.warn(`Confirmation rejected due to stale state. ID: ${shortId(id)}.`);
      return null;
    }

    if (new Date(request.expiresAt).getTime() <= now.getTime()) {
      request.status = "expired";
      this.logger.info(`Confirmation expired for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);
      return request;
    }

    const readiness = this.evaluateReadiness(request.action, now);
    const stale = !readiness.ready
      || readiness.dateKey !== request.dateKey
      || readiness.generatedScheduleTime !== request.generatedScheduleTime
      || readiness.schedulerStatus !== request.schedulerStatusAtCreation;

    if (stale) {
      this.logger.warn(`Confirmation rejected due to stale state for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);
      return request;
    }

    request.status = "accepted";
    this.logger.info(`Confirmation accepted for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}. No configured action performed.`);
    return request;
  }

  cancelConfirmation(id: string): ConfirmationRequest | null {
    const request = this.confirmations.get(id);
    if (!request || request.status !== "pending") {
      this.logger.warn(`Confirmation rejected due to stale state. ID: ${shortId(id)}.`);
      return null;
    }

    request.status = "cancelled";
    this.logger.info(`Confirmation cancelled for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);
    return request;
  }

  latestDryRun(): DryRunExecutionResult | null {
    const matches = [...this.dryRuns.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return matches[0] ?? null;
  }

  latestExecution(): AttendanceExecutionResult | null {
    const matches = [...this.executions.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return matches[0] ?? null;
  }

  markAttendanceManuallyVerified(confirmationId: string, now = new Date()): AttendanceCompletionRecord | null {
    const completion = [...this.completedActions.values()].find((record) => record.confirmationId === confirmationId) ?? null;

    if (!completion) {
      this.logger.warn(`Manual visual confirmation rejected: completion not found. ID: ${shortId(confirmationId)}.`);
      return null;
    }

    const verification: AttendanceVerificationResult = {
      action: completion.action,
      dateKey: completion.dateKey,
      localClickResult: "click-succeeded-local",
      status: "manually-verified",
      reason: "User visually confirmed the configured-action result in the Perakam browser.",
      sanitizedUrlAfterClick: completion.sanitizedUrlAfterClick,
      evidenceSnippets: [],
      checkedAt: now.toISOString(),
      observedValueBefore: completion.verification?.observedValueBefore ?? null,
      observedValueAfter: completion.verification?.observedValueAfter ?? null,
      observedPageState: completion.verification?.observedPageState ?? null,
      observedSource: completion.verification?.observedSource ?? null,
      observedAt: completion.verification?.observedAt ?? null
    };

    completion.state = "manually-verified";
    completion.verification = verification;
    completion.manuallyVerifiedAt = now.toISOString();
    this.completedActions.set(completedKey(completion.dateKey, completion.action), completion);
    this.sources.persistCompletion(completion);
    this.logger.info(`Manual visual confirmation recorded for ${completion.action} on ${completion.dateKey}. ID: ${shortId(completion.confirmationId)}.`);
    return completion;
  }

  async runAttendanceDryRun(confirmationId: string, now = new Date()): Promise<DryRunExecutionResult> {
    this.expirePendingConfirmations(now);
    this.logger.info(`Dry-run requested. Confirmation ID: ${shortId(confirmationId)}.`);

    let request: ConfirmationRequest | null = null;
    let result: DryRunExecutionResult;

    try {
      request = this.confirmations.get(confirmationId) ?? null;
      if (request) {
        await this.sources.refreshPerakamStatus();
      }
      result = request
        ? this.runDryRunForConfirmation(request, now)
        : this.buildDryRunResult({
          request: null,
          now,
          checks: [
            safetyCheck("confirmation exists", false, "Confirmation does not exist.")
          ],
          rejectionReasons: ["missing-confirmation"]
        });
    } catch (error) {
      result = this.buildFailedDryRunResult(request, confirmationId, now, error);
    }

    this.dryRuns.set(confirmationId || result.confirmationId, result);
    this.logDryRunResult(result);
    return result;
  }

  async runGuardedAttendanceClick(confirmationId: string, now = new Date()): Promise<AttendanceExecutionResult> {
    this.expirePendingConfirmations(now);
    this.logger.info(`Configured action execution requested. Confirmation ID: ${shortId(confirmationId)}.`);

    let request: ConfirmationRequest | null = null;
    let result: AttendanceExecutionResult;
    let clickAttemptStarted = false;

    try {
      const claim = this.claimConfirmationForExecution(confirmationId, now);

      if (!claim.request || claim.rejectionReasons.length > 0) {
        result = this.buildClaimRejectedExecutionResult(confirmationId, claim.request, claim.rejectionReasons, now);
        this.executions.set(confirmationId || result.confirmationId, result);
        this.logExecutionResult(result);
        return result;
      }

      request = claim.request;
      await this.sources.refreshPerakamStatus();
      const dryRun = this.runDryRunForConfirmation(request, now, true);

      if (dryRun.rejectionReasons.length > 0) {
        this.releaseConfirmationClaim(request.id, dryRun.rejectionReasons.join(", ") || "safety-check-rejected", now);
        result = this.buildRejectedExecutionResult(request, dryRun, now);
      } else {
        this.logger.info(`Configured-target click started for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);
        const observedBefore = await this.captureObservedValuesBeforeAction(request.action, request.dateKey);
        clickAttemptStarted = true;
        const clickResult = await this.sources.clickVisibleAttendanceControl(request.action);
        let completion = this.markConfirmationUsedAndCompleted(request, clickResult, now);
        const verification = await this.verifyPostClickCompletion(completion, "click-succeeded-local", observedBefore);
        completion = this.applyVerificationToCompletion(completion, verification);
        result = this.buildSucceededExecutionResult(request, clickResult, completion, dryRun, now);
      }
    } catch (error) {
      const message = sanitizeDryRunError(error);
      if (request?.status === "in-flight") {
        if (clickAttemptStarted) {
          this.markConfirmationFailed(request.id, message, now);
          this.markAttemptedCompletion(request, message, now);
        } else {
          this.releaseConfirmationClaim(request.id, message, now);
        }
      }
      result = this.buildFailedExecutionResult(request, confirmationId, now, error);
    }

    this.executions.set(confirmationId || result.confirmationId, result);
    this.logExecutionResult(result);
    return result;
  }

  private evaluateReadiness(action: AttendanceActionType, now: Date): ReadinessSnapshot {
    const schedule = this.sources.getScheduleSnapshot();
    const browser = this.sources.getBrowserStatus();
    const perakam = this.sources.getPerakamStatus();
    const actionSnapshot = findAction(schedule, action);
    const reasons: NotReadyReason[] = [];
    const controlAvailability = controlSnapshot(action, perakam);

    if (schedule.isWeekend) {
      reasons.push("weekend");
    }

    if (schedule.isTodaySkipped) {
      reasons.push("skipped");
    }

    if (!READY_STATUSES.includes(actionSnapshot.status)) {
      reasons.push("outside-schedule-window");
    }

    if (browser.state !== "running") {
      reasons.push("browser-not-running");
    }

    if (!perakam.currentUrl || perakam.status === "not-opened") {
      reasons.push("perakam-not-opened");
    } else if (perakam.status === "login-required" || perakam.status === "likely-login-required") {
      reasons.push("perakam-login-required");
    } else if (perakam.status === "stale-session") {
      reasons.push("perakam-stale-session");
    } else if (perakam.status === "unknown" || perakam.status === "reachable" || perakam.status === "loading") {
      reasons.push("perakam-state-unknown");
    } else if (!isPerakamDashboardReady(perakam)) {
      reasons.push("perakam-not-reachable");
    }

    if (perakam.currentUrl && !isSameHost(perakam.currentUrl, this.sources.getConfiguredPerakamUrl())) {
      reasons.push("perakam-url-mismatch");
    }

    if (browser.lastError) {
      reasons.push("browser-error");
    }

    if (perakam.lastError) {
      reasons.push("perakam-error");
    }

    if (controlAvailability.availability !== "available") {
      reasons.push("control-unavailable");
    }

    const completion = this.completedActions.get(completedKey(schedule.today, action)) ?? null;
    if (completion) {
      reasons.push("already-completed");
    }

    const activeConfirmation = this.latestConfirmation(schedule.today, action);
    const ready = reasons.length === 0;

    return {
      action,
      state: ready ? "ready" : "not-ready",
      ready,
      statusText: ready ? readyText(action) : "Not ready",
      reasons,
      reasonText: ready ? readyText(action) : reasonText(reasons, this.sources.getPerakamAutoLoginSnapshot()),
      dateKey: schedule.today,
      generatedScheduleTime: actionSnapshot.time,
      schedulerStatus: actionSnapshot.status,
      controlAvailability,
      activeConfirmation,
      latestDryRun: activeConfirmation ? this.dryRuns.get(activeConfirmation.id) ?? null : this.latestDryRunForAction(schedule.today, action),
      latestExecution: activeConfirmation ? this.executions.get(activeConfirmation.id) ?? null : this.latestExecutionForAction(schedule.today, action),
      completed: completion
    };
  }

  private latestConfirmation(dateKey: string, action: AttendanceActionType): ConfirmationRequest | null {
    const matches = [...this.confirmations.values()]
      .filter((request) => request.dateKey === dateKey && request.action === action)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return matches[0] ?? null;
  }

  private latestDryRunForAction(dateKey: string, action: AttendanceActionType): DryRunExecutionResult | null {
    const matches = [...this.dryRuns.values()]
      .filter((result) => result.dateKey === dateKey && result.action === action)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return matches[0] ?? null;
  }

  private latestExecutionForAction(dateKey: string, action: AttendanceActionType): AttendanceExecutionResult | null {
    const matches = [...this.executions.values()]
      .filter((result) => result.dateKey === dateKey && result.action === action)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return matches[0] ?? null;
  }

  private runDryRunForConfirmation(request: ConfirmationRequest, now: Date, allowClaimed = false): DryRunExecutionResult {
    const checks: DryRunSafetyCheckResult[] = [];
    const rejectionReasons: DryRunRejectionReason[] = [];
    const schedule = this.sources.getScheduleSnapshot();
    const browser = this.sources.getBrowserStatus();
    const perakam = this.sources.getPerakamStatus();
    const actionSnapshot = findAction(schedule, request.action);
    const controlAvailability = controlSnapshot(request.action, perakam);

    addCheck(checks, rejectionReasons, "confirmation exists", true, "Confirmation exists.", "missing-confirmation");
    const executableStatus = request.status === "accepted" || Boolean(allowClaimed && request.status === "in-flight");
    addCheck(checks, rejectionReasons, "confirmation status executable", executableStatus, statusReason(request.status), statusRejectionReason(request.status));
    addCheck(checks, rejectionReasons, "confirmation is not already used", request.status !== "used", "Confirmation has not been used.", "confirmation-used");
    addCheck(checks, rejectionReasons, "confirmation is not expired", new Date(request.expiresAt).getTime() > now.getTime(), "Confirmation has not expired.", "confirmation-expired");
    addCheck(checks, rejectionReasons, "date matches today", request.dateKey === schedule.today, "Confirmation date matches today.", "date-mismatch");
    addCheck(checks, rejectionReasons, "action type valid", isAttendanceAction(request.action), "Action type is valid.", "invalid-action");
    addCheck(checks, rejectionReasons, "schedule time unchanged", request.generatedScheduleTime === actionSnapshot.time, "Generated schedule time still matches.", "stale-confirmation");
    addCheck(checks, rejectionReasons, "scheduler status still allowed", READY_STATUSES.includes(actionSnapshot.status), "Scheduler status is due now or within grace period.", "outside-schedule-window");
    addCheck(checks, rejectionReasons, "today is not weekend", !schedule.isWeekend, "Today is not a weekend.", "weekend");
    addCheck(checks, rejectionReasons, "today is not skipped", !schedule.isTodaySkipped, "Today is not skipped.", "skipped");
    addCheck(checks, rejectionReasons, "browser is running", browser.state === "running", "Browser is running.", "browser-not-running");
    addCheck(checks, rejectionReasons, "Perakam page is open", Boolean(perakam.currentUrl) && perakam.status !== "not-opened", "Perakam page is open.", "perakam-not-opened");
    addCheck(checks, rejectionReasons, "Perakam dashboard is detected", isPerakamDashboardReady(perakam), perakam.statusReason, "perakam-not-reachable");
    addCheck(checks, rejectionReasons, "Perakam URL host matches config", Boolean(perakam.currentUrl) && isSameHost(perakam.currentUrl ?? "", this.sources.getConfiguredPerakamUrl()), "Perakam URL is on configured host.", "perakam-url-mismatch");
    addCheck(checks, rejectionReasons, "browser has no unresolved error", !browser.lastError, "No unresolved browser error.", "browser-error");
    addCheck(checks, rejectionReasons, "Perakam has no unresolved error", !perakam.lastError, "No unresolved Perakam error.", "perakam-error");
    addCheck(checks, rejectionReasons, "correct control is available", controlAvailability.availability === "available", controlAvailability.reason, "control-unavailable");
    addCheck(checks, rejectionReasons, "not already completed", !this.completedActions.has(completedKey(schedule.today, request.action)), "No completed action exists for date/action.", "already-completed");

    return this.buildDryRunResult({
      request,
      now,
      checks,
      rejectionReasons
    });
  }

  private buildDryRunResult(input: {
    request: ConfirmationRequest | null;
    now: Date;
    checks: DryRunSafetyCheckResult[];
    rejectionReasons: DryRunRejectionReason[];
  }): DryRunExecutionResult {
    const schedule = this.sources.getScheduleSnapshot();
    const browser = this.sources.getBrowserStatus();
    const perakam = this.sources.getPerakamStatus();
    const action = input.request?.action ?? null;
    const actionSnapshot = action ? findAction(schedule, action) : null;
    const controlAvailability = action
      ? controlSnapshot(action, perakam)
      : {
        availability: "unknown" as const,
        reason: "No confirmation action available.",
        checkedAt: perakam.lastButtonCheckAt
      };
    const uniqueReasons = uniqueRejectionReasons(input.rejectionReasons);
    const status = uniqueReasons.length > 0 ? "rejected" : "passed";

    return {
      confirmationId: input.request?.id ?? "missing",
      dateKey: input.request?.dateKey ?? null,
      action,
      generatedScheduleTime: input.request?.generatedScheduleTime ?? null,
      schedulerStatusAtDryRun: actionSnapshot?.status ?? null,
      sanitizedPerakamUrl: perakam.currentUrl,
      browserStatus: browser,
      perakamStatus: perakam,
      controlAvailability,
      safetyChecks: input.checks,
      rejectionReasons: uniqueReasons,
      status,
      summary: status === "passed"
        ? "Dry-run passed. A future guarded execution would be eligible. No configured action was performed."
        : `Dry-run rejected. ${uniqueReasons.length} safety check(s) did not pass. No configured action was performed.`,
      createdAt: input.now.toISOString()
    };
  }

  private buildFailedDryRunResult(
    request: ConfirmationRequest | null,
    confirmationId: string,
    now: Date,
    error: unknown
  ): DryRunExecutionResult {
    const schedule = this.sources.getScheduleSnapshot();
    const browser = this.sources.getBrowserStatus();
    const perakam = this.sources.getPerakamStatus();
    const action = request?.action ?? null;
    const actionSnapshot = action ? findAction(schedule, action) : null;
    const controlAvailability = action
      ? controlSnapshot(action, perakam)
      : {
        availability: "unknown" as const,
        reason: "Dry-run failed before an action could be verified.",
        checkedAt: perakam.lastButtonCheckAt
      };
    const message = sanitizeDryRunError(error);

    return {
      confirmationId: request?.id ?? (confirmationId || "missing"),
      dateKey: request?.dateKey ?? null,
      action,
      generatedScheduleTime: request?.generatedScheduleTime ?? null,
      schedulerStatusAtDryRun: actionSnapshot?.status ?? null,
      sanitizedPerakamUrl: perakam.currentUrl,
      browserStatus: browser,
      perakamStatus: perakam,
      controlAvailability,
      safetyChecks: [
        safetyCheck("dry-run completed without unexpected error", false, message)
      ],
      rejectionReasons: ["unknown"],
      status: "failed",
      summary: `Dry-run failed unexpectedly: ${message}. No configured action was performed.`,
      createdAt: now.toISOString()
    };
  }

  private claimConfirmationForExecution(id: string, now: Date): {
    request: ConfirmationRequest | null;
    rejectionReasons: DryRunRejectionReason[];
  } {
    this.logger.info(`Configured action execution claim attempted. ID: ${shortId(id)}.`);
    const request = this.confirmations.get(id) ?? null;

    if (!request) {
      this.logger.warn(`Configured action execution claim rejected: missing confirmation. ID: ${shortId(id)}.`);
      return { request: null, rejectionReasons: ["missing-confirmation"] };
    }

    const terminalReason = claimRejectionReason(request.status);
    if (terminalReason && request.status !== "pending" && request.status !== "accepted") {
      this.logger.warn(`Configured action execution claim rejected: ${request.status}. ID: ${shortId(request.id)}.`);
      return { request, rejectionReasons: [terminalReason] };
    }

    if (new Date(request.expiresAt).getTime() <= now.getTime()) {
      request.status = "expired";
      this.logger.warn(`Configured action execution claim rejected: expired confirmation. ID: ${shortId(request.id)}.`);
      return { request, rejectionReasons: ["confirmation-expired"] };
    }

    if (terminalReason) {
      this.logger.warn(`Configured action execution claim rejected: ${request.status}. ID: ${shortId(request.id)}.`);
      return { request, rejectionReasons: [terminalReason] };
    }

    request.status = "in-flight";
    request.claimedAt = now.toISOString();
    request.failureReason = null;
    this.logger.info(`Configured action execution claim accepted for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);
    return { request, rejectionReasons: [] };
  }

  private releaseConfirmationClaim(id: string, reason: string, now: Date): void {
    const request = this.confirmations.get(id);
    if (!request || request.status !== "in-flight") {
      return;
    }

    request.status = "accepted";
    request.failedAt = now.toISOString();
    request.failureReason = reason;
    this.logger.warn(`Configured action execution claim released for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}. Reason: ${reason}.`);
  }

  private markConfirmationFailed(id: string, reason: string, now: Date): void {
    const request = this.confirmations.get(id);
    if (!request) {
      return;
    }

    request.status = "failed";
    request.failedAt = now.toISOString();
    request.failureReason = reason;
    this.logger.error(`Configured action execution finalized as failed for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}. Reason: ${reason}.`);
  }

  private markConfirmationUsedAndCompleted(
    request: ConfirmationRequest,
    clickResult: AttendanceBrowserExecutionResult,
    now: Date
  ): AttendanceCompletionRecord {
    request.status = "used";
    request.usedAt = now.toISOString();
    this.logger.info(`Configured action confirmation marked used for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);

    const completion: AttendanceCompletionRecord = {
      dateKey: request.dateKey,
      action: request.action,
      confirmationId: request.id,
      mappedTargetId: clickResult.mappedTargetId,
      completedAt: now.toISOString(),
      generatedScheduleTime: request.generatedScheduleTime,
      sanitizedUrlAfterClick: clickResult.afterUrl,
      state: "verification-pending",
      verification: {
        action: request.action,
        dateKey: request.dateKey,
        localClickResult: "click-succeeded-local",
        status: "pending",
        reason: "Local click succeeded. Read-only verification is pending.",
        sanitizedUrlAfterClick: clickResult.afterUrl,
        evidenceSnippets: [],
        checkedAt: now.toISOString(),
        observedValueBefore: null,
        observedValueAfter: null,
        observedPageState: null,
        observedSource: null,
        observedAt: null
      },
      manuallyVerifiedAt: null
    };

    this.completedActions.set(completedKey(request.dateKey, request.action), completion);
    this.sources.persistCompletion(completion);
    this.logger.info(`Configured action ${request.action} marked completed on ${request.dateKey}. ID: ${shortId(request.id)}.`);
    return completion;
  }

  private markAttemptedCompletion(request: ConfirmationRequest, reason: string, now: Date): AttendanceCompletionRecord {
    const completion: AttendanceCompletionRecord = {
      dateKey: request.dateKey,
      action: request.action,
      confirmationId: request.id,
      mappedTargetId: attendanceTargetId(request.action),
      completedAt: now.toISOString(),
      generatedScheduleTime: request.generatedScheduleTime,
      sanitizedUrlAfterClick: request.sanitizedUrl,
      state: "click-attempted",
      verification: {
        action: request.action,
        dateKey: request.dateKey,
        localClickResult: "click-attempted",
        status: "verification-failed",
        reason,
        sanitizedUrlAfterClick: request.sanitizedUrl,
        evidenceSnippets: [],
        checkedAt: now.toISOString(),
        observedValueBefore: null,
        observedValueAfter: null,
        observedPageState: null,
        observedSource: null,
        observedAt: null
      },
      manuallyVerifiedAt: null
    };

    this.completedActions.set(completedKey(request.dateKey, request.action), completion);
    this.sources.persistCompletion(completion);
    this.logger.warn(`Configured action ${request.action} marked attempted on ${request.dateKey}; repeat execution blocked. ID: ${shortId(request.id)}.`);
    return completion;
  }

  private async verifyPostClickCompletion(
    completion: AttendanceCompletionRecord,
    localClickResult: AttendanceVerificationResult["localClickResult"],
    observedBefore: PerakamObservedValuesSnapshot | null
  ): Promise<AttendanceVerificationResult> {
    this.logger.info(`Post-click verification started for ${completion.action} on ${completion.dateKey}. ID: ${shortId(completion.confirmationId)}.`);

    try {
      const verification = await this.sources.verifyAttendanceAfterClick(completion.action, completion.dateKey, localClickResult, observedBefore);

      if (verification.status === "verified-success" || verification.status === "already-present") {
        this.logger.info(`Post-click verification succeeded for ${completion.action} on ${completion.dateKey}. ID: ${shortId(completion.confirmationId)}.`);
        return verification;
      }

      if (verification.status === "verification-failed") {
        this.logger.warn(`Post-click verification failed for ${completion.action} on ${completion.dateKey}. ID: ${shortId(completion.confirmationId)}. Reason: ${verification.reason}.`);
        return verification;
      }

      this.logger.warn(`Post-click verification unknown for ${completion.action} on ${completion.dateKey}. ID: ${shortId(completion.confirmationId)}. Reason: ${verification.reason}.`);
      return verification;
    } catch (error) {
      const checkedAt = new Date().toISOString();
      const reason = sanitizeDryRunError(error);
      this.logger.warn(`Post-click verification unknown for ${completion.action} on ${completion.dateKey}. ID: ${shortId(completion.confirmationId)}. Reason: ${reason}.`);
      return {
        action: completion.action,
        dateKey: completion.dateKey,
        localClickResult,
        status: "verification-unknown",
        reason,
        sanitizedUrlAfterClick: completion.sanitizedUrlAfterClick,
        evidenceSnippets: [],
        checkedAt,
        observedValueBefore: observedBefore ? observedValueForAction(observedBefore, completion.action) : null,
        observedValueAfter: null,
        observedPageState: observedBefore?.pageState ?? null,
        observedSource: observedBefore?.source ?? null,
        observedAt: observedBefore?.observedAt ?? null
      };
    }
  }

  private async captureObservedValuesBeforeAction(action: AttendanceActionType, dateKey: string): Promise<PerakamObservedValuesSnapshot | null> {
    try {
      const observed = await this.sources.refreshObservedPerakamValues();
      const value = observedValueForAction(observed, action);
      this.logger.info(`Pre-action observed Perakam ${action} value for ${dateKey}: ${value ? "present" : "missing"}; page=${observed.pageState}.`);
      return observed;
    } catch (error) {
      this.logger.warn(`Pre-action observed Perakam value capture skipped: ${sanitizeDryRunError(error)}.`);
      return null;
    }
  }

  private applyVerificationToCompletion(
    completion: AttendanceCompletionRecord,
    verification: AttendanceVerificationResult
  ): AttendanceCompletionRecord {
    completion.verification = verification;
    completion.sanitizedUrlAfterClick = verification.sanitizedUrlAfterClick;

    if (verification.status === "verified-success") {
      completion.state = "verified-success";
    } else if (verification.status === "already-present") {
      completion.state = "already-present";
    } else if (verification.status === "verification-failed") {
      completion.state = "verification-failed";
    } else {
      completion.state = "verification-unknown";
    }

    this.completedActions.set(completedKey(completion.dateKey, completion.action), completion);
    this.sources.persistCompletion(completion);
    return completion;
  }

  private buildClaimRejectedExecutionResult(
    confirmationId: string,
    request: ConfirmationRequest | null,
    rejectionReasons: DryRunRejectionReason[],
    now: Date
  ): AttendanceExecutionResult {
    const schedule = this.sources.getScheduleSnapshot();
    const browser = this.sources.getBrowserStatus();
    const perakam = this.sources.getPerakamStatus();
    const action = request?.action ?? null;
    const actionSnapshot = action ? findAction(schedule, action) : null;
    const reasons = uniqueRejectionReasons(rejectionReasons);

    return {
      confirmationId: request?.id ?? (confirmationId || "missing"),
      dateKey: request?.dateKey ?? null,
      action,
      mappedTargetId: action ? attendanceTargetId(action) : null,
      generatedScheduleTime: request?.generatedScheduleTime ?? null,
      schedulerStatusAtExecution: actionSnapshot?.status ?? null,
      sanitizedUrlBeforeClick: perakam.currentUrl,
      sanitizedUrlAfterClick: perakam.currentUrl,
      browserStatus: browser,
      perakamStatus: perakam,
      controlAvailability: action ? controlSnapshot(action, perakam) : unknownControlSnapshot("Execution claim failed before an action could be verified.", perakam),
      safetyChecks: [
        safetyCheck("execution claim accepted", false, claimRejectionText(reasons[0] ?? "unknown"))
      ],
      rejectionReasons: reasons,
      status: "rejected",
      completionState: null,
      verification: null,
      summary: `Configured action execution rejected before click. Claim failed: ${claimRejectionText(reasons[0] ?? "unknown")}`,
      createdAt: now.toISOString()
    };
  }

  private buildRejectedExecutionResult(
    request: ConfirmationRequest,
    dryRun: DryRunExecutionResult,
    now: Date
  ): AttendanceExecutionResult {
    return {
      confirmationId: request.id,
      dateKey: request.dateKey,
      action: request.action,
      mappedTargetId: attendanceTargetId(request.action),
      generatedScheduleTime: request.generatedScheduleTime,
      schedulerStatusAtExecution: dryRun.schedulerStatusAtDryRun,
      sanitizedUrlBeforeClick: dryRun.sanitizedPerakamUrl,
      sanitizedUrlAfterClick: dryRun.sanitizedPerakamUrl,
      browserStatus: dryRun.browserStatus,
      perakamStatus: dryRun.perakamStatus,
      controlAvailability: dryRun.controlAvailability,
      safetyChecks: dryRun.safetyChecks,
      rejectionReasons: dryRun.rejectionReasons,
      status: "rejected",
      completionState: null,
      verification: null,
      summary: `Configured action execution rejected. ${dryRun.rejectionReasons.length} safety check(s) did not pass. No click was performed.`,
      createdAt: now.toISOString()
    };
  }

  private buildSucceededExecutionResult(
    request: ConfirmationRequest,
    clickResult: AttendanceBrowserExecutionResult,
    completion: AttendanceCompletionRecord,
    dryRun: DryRunExecutionResult,
    now: Date
  ): AttendanceExecutionResult {
    return {
      confirmationId: request.id,
      dateKey: request.dateKey,
      action: request.action,
      mappedTargetId: clickResult.mappedTargetId,
      generatedScheduleTime: request.generatedScheduleTime,
      schedulerStatusAtExecution: dryRun.schedulerStatusAtDryRun,
      sanitizedUrlBeforeClick: clickResult.beforeUrl,
      sanitizedUrlAfterClick: clickResult.afterUrl,
      browserStatus: this.sources.getBrowserStatus(),
      perakamStatus: this.sources.getPerakamStatus(),
      controlAvailability: clickResult.controlAvailability,
      safetyChecks: dryRun.safetyChecks,
      rejectionReasons: [],
      status: "succeeded",
      completionState: completion.state,
      verification: completion.verification,
      summary: executionSummaryForCompletion(request.action, completion),
      createdAt: now.toISOString()
    };
  }

  private buildFailedExecutionResult(
    request: ConfirmationRequest | null,
    confirmationId: string,
    now: Date,
    error: unknown
  ): AttendanceExecutionResult {
    const schedule = this.sources.getScheduleSnapshot();
    const browser = this.sources.getBrowserStatus();
    const perakam = this.sources.getPerakamStatus();
    const action = request?.action ?? null;
    const actionSnapshot = action ? findAction(schedule, action) : null;
    const message = sanitizeDryRunError(error);

    return {
      confirmationId: request?.id ?? (confirmationId || "missing"),
      dateKey: request?.dateKey ?? null,
      action,
      mappedTargetId: action ? attendanceTargetId(action) : null,
      generatedScheduleTime: request?.generatedScheduleTime ?? null,
      schedulerStatusAtExecution: actionSnapshot?.status ?? null,
      sanitizedUrlBeforeClick: perakam.currentUrl,
      sanitizedUrlAfterClick: perakam.currentUrl,
      browserStatus: browser,
      perakamStatus: perakam,
      controlAvailability: action ? controlSnapshot(action, perakam) : unknownControlSnapshot("Execution failed before an action could be verified.", perakam),
      safetyChecks: [
        safetyCheck("configured-target click completed without unexpected error", false, message)
      ],
      rejectionReasons: ["unknown"],
      status: "failed",
      completionState: null,
      verification: null,
      summary: `Configured action execution failed unexpectedly: ${message}. Start a fresh readiness and confirmation flow before retrying.`,
      createdAt: now.toISOString()
    };
  }

  private logExecutionResult(result: AttendanceExecutionResult): void {
    if (result.status === "succeeded") {
      this.logger.info(`Configured-target click succeeded for ${result.action} on ${result.dateKey}. Confirmation ID: ${shortId(result.confirmationId)}.`);
      return;
    }

    const reason = result.rejectionReasons.join(", ") || result.summary;
    if (result.status === "rejected") {
      this.logger.warn(`Configured action execution rejected. ID: ${shortId(result.confirmationId)}. Reason: ${reason}.`);
      return;
    }

    this.logger.error(`Configured action execution failed. ID: ${shortId(result.confirmationId)}. Reason: ${reason}.`);
  }

  private logDryRunResult(result: DryRunExecutionResult): void {
    if (result.status === "passed") {
      this.logger.info(`Dry-run passed for ${result.action} on ${result.dateKey}. Confirmation ID: ${shortId(result.confirmationId)}.`);
      return;
    }

    const reason = result.rejectionReasons.join(", ") || "unknown";
    if (result.status === "failed") {
      this.logger.error(`Dry-run failed. ID: ${shortId(result.confirmationId)}. Reason: ${reason}.`);
      return;
    }

    if (result.rejectionReasons.some((entry) => ["missing-confirmation", "confirmation-expired", "confirmation-cancelled", "confirmation-pending", "confirmation-not-accepted"].includes(entry))) {
      this.logger.warn(`Dry-run failed due to expired/missing/non-accepted confirmation. ID: ${shortId(result.confirmationId)}. Reason: ${reason}.`);
      return;
    }

    this.logger.warn(`Dry-run rejected due to stale state. ID: ${shortId(result.confirmationId)}. Reason: ${reason}.`);
  }

  private expirePendingConfirmations(now: Date): void {
    for (const request of this.confirmations.values()) {
      if (request.status !== "pending") {
        continue;
      }

      if (new Date(request.expiresAt).getTime() > now.getTime()) {
        continue;
      }

      request.status = "expired";
      this.logger.info(`Confirmation expired for ${request.action} on ${request.dateKey}. ID: ${shortId(request.id)}.`);
      this.sources.broadcastSnapshot();
    }
  }
}

function findAction(schedule: ScheduleSnapshot, action: AttendanceActionType): ScheduleActionSnapshot {
  const match = schedule.actions.find((candidate) => candidate.action === action);

  if (!match) {
    throw new Error(`Missing schedule action: ${action}`);
  }

  return match;
}

function controlSnapshot(action: AttendanceActionType, perakam: PerakamStatusSnapshot): AttendanceControlSnapshot {
  return action === "clock-in"
    ? {
      availability: perakam.clockInAvailable,
      reason: perakam.clockInReason,
      checkedAt: perakam.lastButtonCheckAt
    }
    : {
      availability: perakam.clockOutAvailable,
      reason: perakam.clockOutReason,
      checkedAt: perakam.lastButtonCheckAt
    };
}

function calculateExpiresAt(readiness: ReadinessSnapshot, gracePeriodMinutes: number, now: Date): Date {
  const scheduledAt = dateTimeFromKey(readiness.dateKey, readiness.generatedScheduleTime);
  const graceEndsAt = new Date(scheduledAt.getTime() + gracePeriodMinutes * 60 * 1000);
  const defaultExpiry = new Date(now.getTime() + CONFIRMATION_WINDOW_MS);
  return new Date(Math.min(defaultExpiry.getTime(), graceEndsAt.getTime()));
}

function dateTimeFromKey(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function isSameHost(currentUrl: string, configuredUrl: string): boolean {
  try {
    return new URL(currentUrl).host === new URL(configuredUrl).host;
  } catch {
    return false;
  }
}

function isAttendanceAction(action: unknown): action is AttendanceActionType {
  return action === "clock-in" || action === "clock-out";
}

function isPerakamDashboardReady(perakam: PerakamStatusSnapshot): boolean {
  return perakam.status === "dashboard" || perakam.status === "likely-logged-in";
}

function safetyCheck(name: string, passed: boolean, reason: string): DryRunSafetyCheckResult {
  return {
    name,
    passed,
    reason
  };
}

function addCheck(
  checks: DryRunSafetyCheckResult[],
  rejectionReasons: DryRunRejectionReason[],
  name: string,
  passed: boolean,
  reason: string,
  rejectionReason: DryRunRejectionReason
): void {
  checks.push(safetyCheck(name, passed, reason));

  if (!passed) {
    rejectionReasons.push(rejectionReason);
  }
}

function statusReason(status: ConfirmationRequest["status"]): string {
  switch (status) {
    case "accepted":
      return "Confirmation is accepted.";
    case "in-flight":
      return "Confirmation is claimed for execution.";
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

function statusRejectionReason(status: ConfirmationRequest["status"]): DryRunRejectionReason {
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

function claimRejectionReason(status: ConfirmationRequest["status"]): DryRunRejectionReason | null {
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

function claimRejectionText(reason: DryRunRejectionReason): string {
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
    case "already-completed":
      return "configured action was already completed for this date.";
    default:
      return "confirmation could not be claimed.";
  }
}

function uniqueRejectionReasons(reasons: DryRunRejectionReason[]): DryRunRejectionReason[] {
  return [...new Set(reasons.filter((reason) => reason !== "unknown"))];
}

function sanitizeDryRunError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown dry-run error.";
  return message.replace(/[?#][^\s]*/g, "?[redacted]").slice(0, 240);
}

function completedKey(dateKey: string, action: AttendanceActionType): string {
  return `${dateKey}:${action}`;
}

function attendanceTargetId(action: AttendanceActionType): "a50" | "a51" {
  return action === "clock-in" ? "a50" : "a51";
}

function actionLabel(action: AttendanceActionType): string {
  return action === "clock-in" ? "morning action" : "evening action";
}

function unknownControlSnapshot(reason: string, perakam: PerakamStatusSnapshot): AttendanceControlSnapshot {
  return {
    availability: "unknown",
    reason,
    checkedAt: perakam.lastButtonCheckAt
  };
}

function executionSummaryForCompletion(action: AttendanceActionType, completion: AttendanceCompletionRecord): string {
  const timeText = new Date(completion.completedAt).toLocaleTimeString();

  switch (completion.state) {
    case "verified-success":
      return `The app clicked the visible Perakam target control for ${actionLabel(action)} once at ${timeText}. Read-only verification suggests Perakam accepted it.`;
    case "already-present":
      return `The app clicked the visible Perakam target control for ${actionLabel(action)} once at ${timeText}. Read-only verification found the website value was already present before the click. Please visually confirm no duplicate action occurred.`;
    case "verification-failed":
      return `The app clicked the visible Perakam target control for ${actionLabel(action)} once at ${timeText}, but read-only verification found possible failure evidence. Please visually confirm in the Perakam browser. The app will not automatically retry.`;
    case "verification-unknown":
    case "click-succeeded-local":
    case "verification-pending":
      return `The app clicked the visible Perakam target control for ${actionLabel(action)} once at ${timeText}. Verification is read-only and could not confirm acceptance. Please visually confirm in the Perakam browser. The app will not automatically retry.`;
    case "manually-verified":
      return `The app clicked the visible Perakam target control for ${actionLabel(action)} once at ${timeText}. You marked the result visually confirmed.`;
    case "click-attempted":
    case "not-attempted":
      return `Configured action ${actionLabel(action)} state is ${completion.state}.`;
  }
}

function readyText(action: AttendanceActionType): string {
  return action === "clock-in"
    ? "Morning action is ready for confirmation. Perakam shows the Masa Hadir control, and the current schedule is within the allowed window."
    : "Evening action is ready for confirmation. Perakam shows the Masa Keluar control, and the current schedule is within the allowed window.";
}

function reasonText(reasons: NotReadyReason[], autoLogin: PerakamAutoLoginSnapshot): string {
  if (reasons.includes("browser-not-running")) {
    return "Not ready: browser is not running.";
  }

  if (reasons.includes("perakam-not-opened")) {
    return "Not ready: Perakam dashboard is not opened.";
  }

  if (reasons.includes("perakam-login-required")) {
    if (autoLogin.inFlight) {
      return "Perakam auto-login in progress.";
    }

    if (!autoLogin.enabled) {
      return "Login required: please log in manually in the browser.";
    }

    if (!autoLogin.hasSavedPassword || !autoLogin.username) {
      return "Login required: saved Perakam credentials are missing.";
    }

    if (autoLogin.lastLoginResult === "failed") {
      return "Perakam auto-login failed. Please check credentials or log in manually.";
    }

    if (autoLogin.lastLoginResult === "success") {
      return "Perakam auto-login succeeded. Dashboard detected.";
    }

    return "Login required: auto-login is available.";
  }

  if (reasons.includes("perakam-stale-session")) {
    if (autoLogin.inFlight) {
      return "Session stale: returning to Perakam login page.";
    }

    if (!autoLogin.enabled) {
      return "Session stale: Perakam showed a no-user-info page. Please return to login manually.";
    }

    if (!autoLogin.hasSavedPassword || !autoLogin.username) {
      return "Session stale: saved Perakam credentials are missing.";
    }

    if (autoLogin.lastLoginResult === "failed") {
      return "Perakam auto-login failed after stale-session recovery. Please check credentials or log in manually.";
    }

    if (autoLogin.lastLoginResult === "success") {
      return "Perakam auto-login succeeded. Dashboard detected.";
    }

    if (autoLogin.lastLoginResult === "unknown" && autoLogin.lastLoginReason?.toLowerCase().includes("auto-login in progress")) {
      return "Perakam login page detected. Auto-login in progress.";
    }

    return "Session stale: auto-login recovery is available.";
  }

  if (reasons.includes("perakam-state-unknown")) {
    return "Perakam state unknown. Open or inspect the browser manually.";
  }

  if (reasons.includes("skipped") || reasons.includes("weekend")) {
    return "Not ready: today is skipped or is a non-working day.";
  }

  if (reasons.includes("control-unavailable")) {
    return "Not ready: the required Perakam control is not visibly available.";
  }

  if (reasons.includes("already-completed")) {
    return "Configured action completed for this date and action.";
  }

  if (reasons.includes("outside-schedule-window")) {
    return "Not ready: current schedule is outside the confirmation window.";
  }

  if (reasons.includes("perakam-url-mismatch")) {
    return "Not ready: Perakam page is not on the configured host.";
  }

  if (reasons.includes("browser-error") || reasons.includes("perakam-error")) {
    return "Not ready: browser or Perakam status has an unresolved error.";
  }

  if (reasons.includes("perakam-not-reachable")) {
    return "Not ready: Perakam dashboard is not reachable.";
  }

  return "Not ready: readiness could not be confirmed.";
}

function readinessControlSafePerakamSnapshot(perakam: PerakamStatusSnapshot): PerakamStatusSnapshot {
  return {
    ...perakam,
    currentUrl: perakam.currentUrl,
    lastError: perakam.lastError
  };
}

function shortId(id: string): string {
  return id.slice(0, 8);
}
