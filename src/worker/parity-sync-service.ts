import type {
  AppConfig,
  AttendanceActionType,
  AttendanceCompletionRecord,
  AttendanceCompletionState,
  AttendanceVerificationStatus,
  ParityCommandStatus,
  ParityCommandType,
  ParityCompletionPayload,
  ParityDeviceStatusPayload,
  ParityEventLogPayload,
  ParitySchedulePayload,
  ParitySkipDatePayload,
  ParitySyncSnapshot
} from "../shared/types";
import type { AppLogger } from "../main/logger";
import type { EnvLocalSupabaseSettings } from "../main/config-store";
import { looksLikeSupabaseServiceRoleKey } from "../main/config-store";

export const PARITY_COMMAND_TYPES: readonly ParityCommandType[] = [
  "request-status-refresh",
  "request-dry-run",
  "request-confirmation",
  "cancel-confirmation",
  "perform-configured-action",
  "recalculate-today-schedule"
];

export const PARITY_COMMAND_STATUSES: readonly ParityCommandStatus[] = [
  "pending",
  "claimed",
  "succeeded",
  "failed",
  "expired",
  "rejected",
  "cancelled"
];

interface EffectiveParitySyncSettings {
  supabaseUrl: URL;
  publishableKey: string;
}

interface ParitySyncRequestBody {
  deviceStatus: ParityDeviceStatusPayload;
  events: ParityEventLogPayload[];
}

interface SkipSyncRequestBody {
  deviceId: string;
  operation: "list-skips" | "upsert-skip" | "delete-skip";
  skipDate?: string;
  actionKey?: "clock-in" | "clock-out" | null;
  reason?: string | null;
  source?: "desktop-local" | "webapp-command" | "manual-import";
}

interface SkipSyncListResponse {
  success?: boolean;
  skips?: ParitySkipDatePayload[];
}

interface ScheduleCompletionRequestBody {
  deviceId: string;
  operation: "get-day-state" | "upsert-schedule" | "upsert-completion";
  scheduleDate?: string;
  actionDate?: string;
  actionKey?: AttendanceActionType;
  schedule?: Omit<ParitySchedulePayload, "deviceId" | "scheduleDate" | "actionKey">;
  completion?: Omit<ParityCompletionPayload, "deviceId" | "actionDate" | "actionKey">;
}

interface ScheduleCompletionStateResponse {
  success?: boolean;
  schedules?: ParitySchedulePayload[];
  completions?: ParityCompletionPayload[];
}

interface ParitySyncDependencies {
  buildDeviceStatusPayload: () => ParityDeviceStatusPayload;
  mergeRemoteSkippedDates?: (dates: string[]) => number;
  fetchFn?: typeof fetch;
}

export class ParitySyncService {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private skipSyncTimer: NodeJS.Timeout | null = null;
  private scheduleCompletionTimer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private skipInFlight = false;
  private scheduleCompletionInFlight = false;
  private lastStartedAt: string | null = null;
  private lastStoppedAt: string | null = null;
  private lastCheckedAt: string | null = null;
  private lastAttemptAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;
  private publishCount = 0;
  private failureCount = 0;
  private lastSkipAttemptAt: string | null = null;
  private lastSkipSuccessAt: string | null = null;
  private lastSkipError: string | null = null;
  private skipSyncCount = 0;
  private skipUploadCount = 0;
  private skipDeleteCount = 0;
  private skipFailureCount = 0;
  private skipRowsReceived = 0;
  private skipRowsApplied = 0;
  private lastScheduleCompletionAttemptAt: string | null = null;
  private lastScheduleCompletionSuccessAt: string | null = null;
  private lastScheduleCompletionError: string | null = null;
  private scheduleCompletionSyncCount = 0;
  private scheduleUploadCount = 0;
  private completionUploadCount = 0;
  private fetchedScheduleRows = 0;
  private fetchedCompletionRows = 0;
  private scheduleCompletionWarningCount = 0;
  private lastScheduleCompletionWarning: string | null = null;
  private scheduleCompletionFailureCount = 0;
  private hasLoggedDisabled = false;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    private readonly envLocal: EnvLocalSupabaseSettings,
    private readonly dependencies: ParitySyncDependencies
  ) {}

  start(): void {
    if (this.heartbeatTimer) {
      return;
    }

    if (!this.config.paritySync.enabled) {
      this.lastError = null;
      this.logDisabledOnce();
      return;
    }

    if (!this.effectiveSettings()) {
      this.lastError = null;
      this.logger.info("Supabase parity sync not configured; no runtime writes or command processing started.");
      return;
    }

    this.lastStartedAt = new Date().toISOString();
    this.lastStoppedAt = null;
    this.lastError = null;
    this.logger.info("Supabase parity status publisher started. Command processing remains disabled.");

    this.heartbeatTimer = setInterval(() => {
      void this.publishStatus("interval");
    }, this.heartbeatIntervalMs());

    void this.publishStatus("startup");

    if (this.config.paritySync.skipSyncEnabled) {
      this.skipSyncTimer = setInterval(() => {
        void this.syncSkipDates("interval");
      }, this.skipSyncIntervalMs());

      void this.syncSkipDates("startup");
    }

    if (this.config.paritySync.scheduleCompletionSyncEnabled) {
      this.scheduleCompletionTimer = setInterval(() => {
        void this.syncScheduleCompletions("interval");
      }, this.scheduleCompletionSyncIntervalMs());

      void this.syncScheduleCompletions("startup");
    }
  }

  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.skipSyncTimer) {
      clearInterval(this.skipSyncTimer);
      this.skipSyncTimer = null;
    }

    if (this.scheduleCompletionTimer) {
      clearInterval(this.scheduleCompletionTimer);
      this.scheduleCompletionTimer = null;
    }

    if (this.lastStartedAt) {
      this.lastStoppedAt = new Date().toISOString();
      this.logger.info("Supabase parity sync skeleton stopped.");
    }
  }

  configure(): void {
    this.stop();
    this.start();
  }

  getStatus(): ParitySyncSnapshot {
    const effectiveSettings = this.effectiveSettings();
    const active = Boolean(this.heartbeatTimer || this.skipSyncTimer || this.scheduleCompletionTimer);
    const enabled = this.config.paritySync.enabled;
    const configured = Boolean(effectiveSettings);

    return {
      enabled,
      configured,
      active,
      health: !enabled ? "disabled" : configured ? this.lastError ? "error" : active ? "active" : "idle" : "not-configured",
      endpointHost: effectiveSettings?.supabaseUrl.host ?? null,
      keyStatus: this.keyStatus(),
      deviceId: this.config.paritySync.deviceId,
      deviceLabel: sanitizeStatusText(this.config.paritySync.deviceLabel || "A.L.I.L.O.S. desktop", 120) ?? "A.L.I.L.O.S. desktop",
      heartbeatIntervalSeconds: this.config.paritySync.heartbeatIntervalSeconds,
      commandPollIntervalSeconds: this.config.paritySync.commandPollIntervalSeconds,
      featureFlags: {
        logUploadEnabled: this.config.paritySync.logUploadEnabled,
        skipSyncEnabled: this.config.paritySync.skipSyncEnabled,
        commandSyncEnabled: this.config.paritySync.commandSyncEnabled,
        scheduleCompletionSyncEnabled: this.config.paritySync.scheduleCompletionSyncEnabled
      },
      lastStartedAt: this.lastStartedAt,
      lastStoppedAt: this.lastStoppedAt,
      lastCheckedAt: this.lastCheckedAt,
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      publishCount: this.publishCount,
      failureCount: this.failureCount,
      skipSync: {
        enabled: enabled && this.config.paritySync.skipSyncEnabled,
        active: Boolean(this.skipSyncTimer),
        lastAttemptAt: this.lastSkipAttemptAt,
        lastSuccessAt: this.lastSkipSuccessAt,
        lastError: this.lastSkipError,
        syncCount: this.skipSyncCount,
        uploadCount: this.skipUploadCount,
        deleteCount: this.skipDeleteCount,
        failureCount: this.skipFailureCount,
        rowsReceived: this.skipRowsReceived,
        rowsApplied: this.skipRowsApplied
      },
      scheduleCompletionSync: {
        enabled: enabled && this.config.paritySync.scheduleCompletionSyncEnabled,
        active: Boolean(this.scheduleCompletionTimer),
        lastAttemptAt: this.lastScheduleCompletionAttemptAt,
        lastSuccessAt: this.lastScheduleCompletionSuccessAt,
        lastError: this.lastScheduleCompletionError,
        syncCount: this.scheduleCompletionSyncCount,
        scheduleUploadCount: this.scheduleUploadCount,
        completionUploadCount: this.completionUploadCount,
        fetchedScheduleRows: this.fetchedScheduleRows,
        fetchedCompletionRows: this.fetchedCompletionRows,
        warningCount: this.scheduleCompletionWarningCount,
        lastWarning: this.lastScheduleCompletionWarning,
        failureCount: this.scheduleCompletionFailureCount
      },
      note: this.note(enabled, configured, active)
    };
  }

  async publishStatus(source = "manual"): Promise<ParitySyncSnapshot> {
    if (this.inFlight) {
      return this.getStatus();
    }

    if (!this.config.paritySync.enabled) {
      return this.getStatus();
    }

    const settings = this.effectiveSettings();
    if (!settings) {
      this.lastError = null;
      this.logger.info("Supabase parity status not sent: URL or publishable key is not configured.");
      return this.getStatus();
    }

    this.inFlight = true;
    this.lastAttemptAt = new Date().toISOString();
    this.lastCheckedAt = this.lastAttemptAt;

    try {
      const body = this.buildRequestBody(source);
      await this.publish(settings, body);
      this.lastSuccessAt = new Date().toISOString();
      this.publishCount += 1;
      this.lastError = null;
      this.logger.info(`Supabase parity status published from ${source} to ${settings.supabaseUrl.host}.`);
    } catch (error) {
      this.failureCount += 1;
      this.lastError = sanitizeError(error);
      this.logger.warn(`Supabase parity status publish failed: ${this.lastError}`);
    } finally {
      this.inFlight = false;
    }

    return this.getStatus();
  }

  async syncSkipDates(source = "manual"): Promise<ParitySyncSnapshot> {
    if (this.skipInFlight) {
      return this.getStatus();
    }

    if (!this.config.paritySync.enabled || !this.config.paritySync.skipSyncEnabled) {
      return this.getStatus();
    }

    const settings = this.effectiveSettings();
    if (!settings) {
      this.lastSkipError = null;
      this.logger.info("Supabase skip sync not sent: URL, publishable key, or device id is not configured.");
      return this.getStatus();
    }

    this.skipInFlight = true;
    this.lastSkipAttemptAt = new Date().toISOString();
    this.lastCheckedAt = this.lastSkipAttemptAt;

    try {
      const response = await this.skipRequest(settings, {
        deviceId: this.config.paritySync.deviceId,
        operation: "list-skips"
      }) as SkipSyncListResponse;
      const remoteSkips = sanitizeSkipRows(response.skips ?? [], this.config.paritySync.deviceId);
      const dates = uniqueSorted(remoteSkips.map((skip) => skip.skipDate));
      const applied = this.dependencies.mergeRemoteSkippedDates?.(dates) ?? 0;

      this.skipRowsReceived = remoteSkips.length;
      this.skipRowsApplied += applied;
      this.skipSyncCount += 1;
      this.lastSkipSuccessAt = new Date().toISOString();
      this.lastSkipError = null;
      this.logger.info(`Supabase skip sync ${source} received ${remoteSkips.length} skip row(s); applied ${applied} local skip date(s).`);
    } catch (error) {
      this.skipFailureCount += 1;
      this.lastSkipError = sanitizeError(error);
      this.logger.warn(`Supabase skip sync failed: ${this.lastSkipError}`);
    } finally {
      this.skipInFlight = false;
    }

    return this.getStatus();
  }

  async upsertSkipDate(skipDate: string, reason = "Desktop local skip"): Promise<ParitySyncSnapshot> {
    if (!this.config.paritySync.enabled || !this.config.paritySync.skipSyncEnabled) {
      return this.getStatus();
    }

    const settings = this.effectiveSettings();
    const sanitizedDate = sanitizeDateText(skipDate);
    if (!settings || !sanitizedDate) {
      return this.getStatus();
    }

    this.lastSkipAttemptAt = new Date().toISOString();
    this.lastCheckedAt = this.lastSkipAttemptAt;

    try {
      await this.skipRequest(settings, {
        deviceId: this.config.paritySync.deviceId,
        operation: "upsert-skip",
        skipDate: sanitizedDate,
        actionKey: null,
        reason: sanitizeStatusText(reason, 500),
        source: "desktop-local"
      });
      this.skipUploadCount += 1;
      this.lastSkipSuccessAt = new Date().toISOString();
      this.lastSkipError = null;
      this.logger.info(`Supabase skip upsert sent for ${sanitizedDate}. Scheduling state only; no configured-site action was attempted.`);
    } catch (error) {
      this.skipFailureCount += 1;
      this.lastSkipError = sanitizeError(error);
      this.logger.warn(`Supabase skip upsert failed: ${this.lastSkipError}`);
    }

    return this.getStatus();
  }

  async deleteSkipDate(skipDate: string): Promise<ParitySyncSnapshot> {
    if (!this.config.paritySync.enabled || !this.config.paritySync.skipSyncEnabled) {
      return this.getStatus();
    }

    const settings = this.effectiveSettings();
    const sanitizedDate = sanitizeDateText(skipDate);
    if (!settings || !sanitizedDate) {
      return this.getStatus();
    }

    this.lastSkipAttemptAt = new Date().toISOString();
    this.lastCheckedAt = this.lastSkipAttemptAt;

    try {
      await this.skipRequest(settings, {
        deviceId: this.config.paritySync.deviceId,
        operation: "delete-skip",
        skipDate: sanitizedDate,
        actionKey: null,
        source: "desktop-local"
      });
      this.skipDeleteCount += 1;
      this.lastSkipSuccessAt = new Date().toISOString();
      this.lastSkipError = null;
      this.logger.info(`Supabase skip delete sent for ${sanitizedDate}. Scheduling state only; no configured-site action was attempted.`);
    } catch (error) {
      this.skipFailureCount += 1;
      this.lastSkipError = sanitizeError(error);
      this.logger.warn(`Supabase skip delete failed: ${this.lastSkipError}`);
    }

    return this.getStatus();
  }

  async syncScheduleCompletions(source = "manual", dateKey = localDateKey(new Date())): Promise<ParitySyncSnapshot> {
    if (this.scheduleCompletionInFlight) {
      return this.getStatus();
    }

    if (!this.config.paritySync.enabled || !this.config.paritySync.scheduleCompletionSyncEnabled) {
      return this.getStatus();
    }

    const settings = this.effectiveSettings();
    const sanitizedDate = sanitizeDateText(dateKey);
    if (!settings || !sanitizedDate) {
      this.lastScheduleCompletionError = null;
      this.logger.info("Supabase schedule/completion sync not sent: URL, publishable key, device id, or date is not configured.");
      return this.getStatus();
    }

    this.scheduleCompletionInFlight = true;
    this.lastScheduleCompletionAttemptAt = new Date().toISOString();
    this.lastCheckedAt = this.lastScheduleCompletionAttemptAt;

    try {
      const state = await this.scheduleCompletionRequest(settings, {
        deviceId: this.config.paritySync.deviceId,
        operation: "get-day-state",
        scheduleDate: sanitizedDate
      }) as ScheduleCompletionStateResponse;
      const remoteSchedules = sanitizeScheduleRows(state.schedules ?? [], this.config.paritySync.deviceId);
      const remoteCompletions = sanitizeCompletionRows(state.completions ?? [], this.config.paritySync.deviceId);
      const localSchedules = buildLocalSchedulePayloads(this.config, this.config.paritySync.deviceId, sanitizedDate);
      const localCompletions = buildLocalCompletionPayloads(this.config, this.config.paritySync.deviceId);
      let scheduleUploads = 0;
      let completionUploads = 0;

      for (const schedule of localSchedules) {
        await this.scheduleCompletionRequest(settings, {
          deviceId: schedule.deviceId,
          operation: "upsert-schedule",
          scheduleDate: schedule.scheduleDate,
          actionKey: schedule.actionKey,
          schedule: {
            targetTimeLocal: schedule.targetTimeLocal,
            windowStartLocal: schedule.windowStartLocal,
            windowEndLocal: schedule.windowEndLocal,
            source: schedule.source,
            status: schedule.status
          }
        });
        scheduleUploads += 1;
      }

      for (const completion of localCompletions) {
        await this.scheduleCompletionRequest(settings, {
          deviceId: completion.deviceId,
          operation: "upsert-completion",
          actionDate: completion.actionDate,
          actionKey: completion.actionKey,
          completion: {
            dedupeKey: completion.dedupeKey,
            state: completion.state,
            verificationState: completion.verificationState,
            sanitizedReason: completion.sanitizedReason,
            attemptedAt: completion.attemptedAt,
            verifiedAt: completion.verifiedAt
          }
        });
        completionUploads += 1;
      }

      const warning = findRemoteCompletionWarning(remoteCompletions, localCompletions, sanitizedDate);
      if (warning) {
        this.scheduleCompletionWarningCount += 1;
        this.lastScheduleCompletionWarning = warning;
        this.logger.warn(`Supabase schedule/completion sync warning: ${warning}`);
      }

      this.fetchedScheduleRows = remoteSchedules.length;
      this.fetchedCompletionRows = remoteCompletions.length;
      this.scheduleUploadCount += scheduleUploads;
      this.completionUploadCount += completionUploads;
      this.scheduleCompletionSyncCount += 1;
      this.lastScheduleCompletionSuccessAt = new Date().toISOString();
      this.lastScheduleCompletionError = null;
      this.logger.info(`Supabase schedule/completion sync ${source} completed for ${sanitizedDate}; uploaded ${scheduleUploads} schedule row(s) and ${completionUploads} completion row(s). No configured-site action was attempted.`);
    } catch (error) {
      this.scheduleCompletionFailureCount += 1;
      this.lastScheduleCompletionError = sanitizeError(error);
      this.logger.warn(`Supabase schedule/completion sync failed: ${this.lastScheduleCompletionError}`);
    } finally {
      this.scheduleCompletionInFlight = false;
    }

    return this.getStatus();
  }

  private logDisabledOnce(): void {
    if (this.hasLoggedDisabled) {
      return;
    }

    this.hasLoggedDisabled = true;
    this.logger.info("Supabase parity sync disabled; no runtime publishing or command processing.");
  }

  private buildRequestBody(source: string): ParitySyncRequestBody {
    const deviceStatus = sanitizeDeviceStatusPayload(this.dependencies.buildDeviceStatusPayload());
    const events = this.config.paritySync.logUploadEnabled
      ? [buildStatusEvent(deviceStatus, source)].map(sanitizeEventPayload).filter((event): event is ParityEventLogPayload => Boolean(event))
      : [];

    return { deviceStatus, events };
  }

  private async publish(settings: EffectiveParitySyncSettings, body: ParitySyncRequestBody): Promise<void> {
    const endpoint = new URL("/functions/v1/alilos-parity-status", settings.supabaseUrl);
    const fetchFn = this.dependencies.fetchFn ?? fetch;
    const response = await fetchFn(endpoint.toString(), {
      method: "POST",
      headers: {
        "apikey": settings.publishableKey,
        "Authorization": `Bearer ${settings.publishableKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Supabase parity status proxy returned HTTP ${response.status}.`);
    }
  }

  private async skipRequest(settings: EffectiveParitySyncSettings, body: SkipSyncRequestBody): Promise<unknown> {
    const endpoint = new URL("/functions/v1/alilos-skip-sync", settings.supabaseUrl);
    const fetchFn = this.dependencies.fetchFn ?? fetch;
    const response = await fetchFn(endpoint.toString(), {
      method: "POST",
      headers: {
        "apikey": settings.publishableKey,
        "Authorization": `Bearer ${settings.publishableKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sanitizeSkipRequestBody(body))
    });

    if (!response.ok) {
      throw new Error(`Supabase skip sync proxy returned HTTP ${response.status}.`);
    }

    return response.json();
  }

  private async scheduleCompletionRequest(settings: EffectiveParitySyncSettings, body: ScheduleCompletionRequestBody): Promise<unknown> {
    const endpoint = new URL("/functions/v1/alilos-schedule-completion-sync", settings.supabaseUrl);
    const fetchFn = this.dependencies.fetchFn ?? fetch;
    const response = await fetchFn(endpoint.toString(), {
      method: "POST",
      headers: {
        "apikey": settings.publishableKey,
        "Authorization": `Bearer ${settings.publishableKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sanitizeScheduleCompletionRequestBody(body))
    });

    if (!response.ok) {
      throw new Error(`Supabase schedule/completion sync proxy returned HTTP ${response.status}.`);
    }

    return response.json();
  }


  private effectiveSettings(): EffectiveParitySyncSettings | null {
    const supabaseUrl = parseSupabaseUrl(this.config.paritySync.supabaseUrl.trim() || this.envLocal.supabaseUrl.trim());
    const publishableKey = (this.config.paritySync.publishableKey.trim() || this.envLocal.publishableKey.trim()).trim();

    if (!supabaseUrl || !publishableKey || looksLikeSupabaseServiceRoleKey(publishableKey) || !isValidDeviceId(this.config.paritySync.deviceId)) {
      return null;
    }

    return { supabaseUrl, publishableKey };
  }

  private keyStatus(): ParitySyncSnapshot["keyStatus"] {
    if (this.config.paritySync.publishableKey.trim()) {
      return looksLikeSupabaseServiceRoleKey(this.config.paritySync.publishableKey) ? "missing" : "configured";
    }

    if (this.envLocal.publishableKey.trim()) {
      return looksLikeSupabaseServiceRoleKey(this.envLocal.publishableKey) ? "missing" : "env-local";
    }

    return "missing";
  }

  private heartbeatIntervalMs(): number {
    return Math.max(this.config.paritySync.heartbeatIntervalSeconds, 30) * 1000;
  }

  private commandPollIntervalMs(): number {
    return Math.max(this.config.paritySync.commandPollIntervalSeconds, 30) * 1000;
  }

  private skipSyncIntervalMs(): number {
    return this.commandPollIntervalMs();
  }

  private scheduleCompletionSyncIntervalMs(): number {
    return this.commandPollIntervalMs();
  }

  private note(enabled: boolean, configured: boolean, active: boolean): string {
    if (!enabled) {
      return "Parity sync is disabled by default.";
    }

    if (!configured) {
      return "Parity sync is enabled but Supabase URL/key are missing or rejected.";
    }

    if (this.lastError) {
      return "Last parity status publish failed; local desktop operation continues.";
    }

    if (active) {
      const activeFeatures = ["status publishing"];
      if (this.config.paritySync.skipSyncEnabled) {
        activeFeatures.push("skip sync");
      }
      if (this.config.paritySync.scheduleCompletionSyncEnabled) {
        activeFeatures.push("schedule/completion sync");
      }
      return `Parity ${activeFeatures.join(", ")} active; command processing remains disabled.`;
    }

    return "Parity sync is configured but idle.";
  }
}

function buildStatusEvent(payload: ParityDeviceStatusPayload, source: string): ParityEventLogPayload {
  return {
    deviceId: payload.deviceId,
    eventTime: payload.recordedAt,
    eventType: "desktop-status",
    severity: "info",
    actionKey: null,
    scheduleDate: null,
    message: "Parity status heartbeat generated.",
    details: {
      source: sanitizeStatusText(source, 80),
      syncHealth: payload.syncHealth,
      executionMode: payload.executionMode,
      browserState: payload.browserState,
      configuredSiteStatus: payload.configuredSiteStatus,
      captivePortalStatus: payload.captivePortalStatus,
      commandProcessing: false,
      directTableWrite: false
    }
  };
}

function sanitizeSkipRequestBody(body: SkipSyncRequestBody): SkipSyncRequestBody {
  const sanitized: SkipSyncRequestBody = {
    deviceId: sanitizeUuidLike(body.deviceId),
    operation: body.operation
  };

  const skipDate = sanitizeDateText(body.skipDate ?? null);
  if (skipDate) {
    sanitized.skipDate = skipDate;
  }

  sanitized.actionKey = body.actionKey === "clock-in" || body.actionKey === "clock-out" ? body.actionKey : null;
  sanitized.reason = sanitizeStatusText(body.reason, 500);
  sanitized.source = body.source === "webapp-command" || body.source === "manual-import" ? body.source : "desktop-local";

  return sanitized;
}

function sanitizeSkipRows(rows: ParitySkipDatePayload[], expectedDeviceId: string): ParitySkipDatePayload[] {
  return rows
    .map((row) => sanitizeSkipRow(row, expectedDeviceId))
    .filter((row): row is ParitySkipDatePayload => Boolean(row));
}

function sanitizeSkipRow(row: ParitySkipDatePayload, expectedDeviceId: string): ParitySkipDatePayload | null {
  const deviceId = sanitizeUuidLike(row.deviceId);
  const skipDate = sanitizeDateText(row.skipDate);

  if (deviceId !== expectedDeviceId || !skipDate) {
    return null;
  }

  return {
    deviceId,
    skipDate,
    actionKey: row.actionKey === "clock-in" || row.actionKey === "clock-out" ? row.actionKey : null,
    reason: sanitizeStatusText(row.reason, 500),
    source: row.source === "webapp-command" || row.source === "manual-import" ? row.source : "desktop-local"
  };
}

function sanitizeScheduleCompletionRequestBody(body: ScheduleCompletionRequestBody): ScheduleCompletionRequestBody {
  const sanitized: ScheduleCompletionRequestBody = {
    deviceId: sanitizeUuidLike(body.deviceId),
    operation: body.operation
  };

  const scheduleDate = sanitizeDateText(body.scheduleDate ?? null);
  if (scheduleDate) {
    sanitized.scheduleDate = scheduleDate;
  }

  const actionDate = sanitizeDateText(body.actionDate ?? null);
  if (actionDate) {
    sanitized.actionDate = actionDate;
  }

  const actionKey = sanitizeActionKey(body.actionKey);
  if (actionKey) {
    sanitized.actionKey = actionKey;
  }

  if (body.schedule) {
    const schedule = sanitizeSchedulePayload({
      deviceId: sanitized.deviceId,
      scheduleDate: scheduleDate ?? "0000-00-00",
      actionKey: actionKey ?? "clock-in",
      ...body.schedule
    });
    if (schedule) {
      sanitized.schedule = {
        targetTimeLocal: schedule.targetTimeLocal,
        windowStartLocal: schedule.windowStartLocal,
        windowEndLocal: schedule.windowEndLocal,
        source: schedule.source,
        status: schedule.status
      };
    }
  }

  if (body.completion) {
    const completion = sanitizeCompletionPayload({
      deviceId: sanitized.deviceId,
      actionDate: actionDate ?? "0000-00-00",
      actionKey: actionKey ?? "clock-in",
      ...body.completion
    });
    if (completion) {
      sanitized.completion = {
        dedupeKey: completion.dedupeKey,
        state: completion.state,
        verificationState: completion.verificationState,
        sanitizedReason: completion.sanitizedReason,
        attemptedAt: completion.attemptedAt,
        verifiedAt: completion.verifiedAt
      };
    }
  }

  return sanitized;
}

function buildLocalSchedulePayloads(config: AppConfig, deviceId: string, dateKey: string): ParitySchedulePayload[] {
  const schedule = config.scheduler.schedulesByDate[dateKey];
  if (!schedule) {
    return [];
  }

  const scheduleDate = sanitizeDateText(schedule.date) ?? dateKey;
  const skipped = config.scheduler.skippedDates.includes(scheduleDate);
  const status: ParitySchedulePayload["status"] = skipped ? "skipped" : "active";
  const rows: ParitySchedulePayload[] = [
    {
      deviceId,
      scheduleDate,
      actionKey: "clock-in",
      targetTimeLocal: sanitizeTimeText(schedule.clockInTime) ?? "00:00",
      windowStartLocal: sanitizeTimeText(config.scheduler.clockInWindow.start),
      windowEndLocal: sanitizeTimeText(config.scheduler.clockInWindow.end),
      source: "local-generated",
      status
    },
    {
      deviceId,
      scheduleDate,
      actionKey: "clock-out",
      targetTimeLocal: sanitizeTimeText(schedule.clockOutTime) ?? "00:00",
      windowStartLocal: sanitizeTimeText(config.scheduler.clockOutWindow.start),
      windowEndLocal: sanitizeTimeText(config.scheduler.clockOutWindow.end),
      source: "local-generated",
      status
    }
  ];

  return rows.map(sanitizeSchedulePayload).filter((row): row is ParitySchedulePayload => Boolean(row));
}

function buildLocalCompletionPayloads(config: AppConfig, deviceId: string): ParityCompletionPayload[] {
  return Object.values(config.attendance.completionsByDate)
    .flat()
    .map((record) => buildCompletionPayload(record, deviceId))
    .filter((row): row is ParityCompletionPayload => Boolean(row));
}

function buildCompletionPayload(record: AttendanceCompletionRecord, deviceId: string): ParityCompletionPayload | null {
  const actionDate = sanitizeDateText(record.dateKey);
  const actionKey = sanitizeActionKey(record.action);
  const state = sanitizeCompletionState(record.state);
  if (!actionDate || !actionKey || !state) {
    return null;
  }

  return sanitizeCompletionPayload({
    deviceId,
    actionDate,
    actionKey,
    dedupeKey: sanitizeStatusText(record.confirmationId || `${deviceId}:${actionDate}:${actionKey}`, 220),
    state,
    verificationState: sanitizeVerificationStatus(record.verification?.status ?? (state === "manually-verified" ? "manually-verified" : null)),
    sanitizedReason: sanitizeStatusText(record.verification?.reason ?? state, 500),
    attemptedAt: sanitizeNullableIsoText(record.completedAt),
    verifiedAt: sanitizeNullableIsoText(record.manuallyVerifiedAt ?? record.verification?.checkedAt ?? null)
  });
}

function sanitizeScheduleRows(rows: ParitySchedulePayload[], expectedDeviceId: string): ParitySchedulePayload[] {
  return rows
    .map((row) => sanitizeSchedulePayload(row))
    .filter((row): row is ParitySchedulePayload => Boolean(row && row.deviceId === expectedDeviceId));
}

function sanitizeCompletionRows(rows: ParityCompletionPayload[], expectedDeviceId: string): ParityCompletionPayload[] {
  return rows
    .map((row) => sanitizeCompletionPayload(row))
    .filter((row): row is ParityCompletionPayload => Boolean(row && row.deviceId === expectedDeviceId));
}

function sanitizeSchedulePayload(row: ParitySchedulePayload): ParitySchedulePayload | null {
  const deviceId = sanitizeUuidLike(row.deviceId);
  const scheduleDate = sanitizeDateText(row.scheduleDate);
  const actionKey = sanitizeActionKey(row.actionKey);
  const targetTimeLocal = sanitizeTimeText(row.targetTimeLocal);
  const source = sanitizeScheduleSource(row.source);
  const status = sanitizeScheduleStatus(row.status);

  if (!scheduleDate || !actionKey || !targetTimeLocal || !source || !status) {
    return null;
  }

  return {
    deviceId,
    scheduleDate,
    actionKey,
    targetTimeLocal,
    windowStartLocal: sanitizeTimeText(row.windowStartLocal),
    windowEndLocal: sanitizeTimeText(row.windowEndLocal),
    source,
    status
  };
}

function sanitizeCompletionPayload(row: ParityCompletionPayload): ParityCompletionPayload | null {
  const deviceId = sanitizeUuidLike(row.deviceId);
  const actionDate = sanitizeDateText(row.actionDate);
  const actionKey = sanitizeActionKey(row.actionKey);
  const state = sanitizeCompletionState(row.state);

  if (!actionDate || !actionKey || !state) {
    return null;
  }

  return {
    deviceId,
    actionDate,
    actionKey,
    dedupeKey: sanitizeStatusText(row.dedupeKey, 220),
    state,
    verificationState: sanitizeVerificationStatus(row.verificationState),
    sanitizedReason: sanitizeStatusText(row.sanitizedReason, 500),
    attemptedAt: sanitizeNullableIsoText(row.attemptedAt),
    verifiedAt: sanitizeNullableIsoText(row.verifiedAt)
  };
}

function findRemoteCompletionWarning(remoteCompletions: ParityCompletionPayload[], localCompletions: ParityCompletionPayload[], dateKey: string): string | null {
  const localKeys = new Set(
    localCompletions
      .filter((completion) => completion.actionDate === dateKey)
      .map((completion) => `${completion.actionDate}:${completion.actionKey}`)
  );
  const remoteOnly = remoteCompletions.find((completion) => completion.actionDate === dateKey && !localKeys.has(`${completion.actionDate}:${completion.actionKey}`));

  return remoteOnly
    ? `Remote completion marker exists for ${remoteOnly.actionKey} on ${dateKey}; no local configured-site action will be triggered.`
    : null;
}

function sanitizeDeviceStatusPayload(payload: ParityDeviceStatusPayload): ParityDeviceStatusPayload {
  return {
    deviceId: sanitizeUuidLike(payload.deviceId),
    deviceLabel: sanitizeStatusText(payload.deviceLabel, 120) ?? "A.L.I.L.O.S. desktop",
    appVersion: sanitizeStatusText(payload.appVersion, 80) ?? "unknown",
    appStatus: sanitizeStatusText(payload.appStatus, 80) ?? "unknown",
    workerState: payload.workerState,
    executionMode: payload.executionMode,
    networkStatus: sanitizeStatusText(payload.networkStatus, 120) ?? "unknown",
    captivePortalStatus: payload.captivePortalStatus,
    configuredSiteStatus: payload.configuredSiteStatus,
    browserState: payload.browserState,
    syncHealth: payload.syncHealth,
    nextActionStatus: payload.nextActionStatus,
    nextScheduleSummary: sanitizeStatusText(payload.nextScheduleSummary, 240),
    completionSummary: sanitizeStatusText(payload.completionSummary, 240),
    lastErrorText: sanitizeStatusText(payload.lastErrorText, 500),
    recordedAt: sanitizeIsoText(payload.recordedAt)
  };
}

function sanitizeEventPayload(payload: ParityEventLogPayload): ParityEventLogPayload | null {
  const message = sanitizeStatusText(payload.message, 500);
  if (!message) {
    return null;
  }

  return {
    deviceId: sanitizeUuidLike(payload.deviceId),
    eventTime: sanitizeIsoText(payload.eventTime),
    eventType: payload.eventType,
    severity: payload.severity,
    actionKey: payload.actionKey === "clock-in" || payload.actionKey === "clock-out" ? payload.actionKey : null,
    scheduleDate: sanitizeDateText(payload.scheduleDate),
    message,
    details: sanitizeDetails(payload.details)
  };
}

function sanitizeDetails(details: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(details).slice(0, 20)) {
    const normalizedKey = key.trim();
    if (!normalizedKey || FORBIDDEN_DETAIL_KEYS.has(normalizedKey.toLowerCase())) {
      continue;
    }

    if (typeof value === "string") {
      sanitized[normalizedKey.slice(0, 80)] = sanitizeStatusText(value, 160);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[normalizedKey.slice(0, 80)] = value;
    }
  }

  return sanitized;
}

const FORBIDDEN_DETAIL_KEYS = new Set([
  "credential",
  "credentials",
  "password",
  "cookie",
  "cookies",
  "html",
  "raw_html",
  "screenshot",
  "url",
  "urls",
  "full_url",
  "token",
  "tokens",
  "link",
  "magic",
  "4tredir",
  "selector",
  "selectors",
  "script",
  "scripts",
  "form",
  "forms"
]);

function sanitizeActionKey(value: AttendanceActionType | null | undefined): AttendanceActionType | null {
  return value === "clock-in" || value === "clock-out" ? value : null;
}

function sanitizeTimeText(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : null;
}

function sanitizeScheduleSource(value: ParitySchedulePayload["source"] | null | undefined): ParitySchedulePayload["source"] | null {
  return value === "recovered-from-supabase" || value === "manual-reconciled" ? value : value === "local-generated" ? value : null;
}

function sanitizeScheduleStatus(value: ParitySchedulePayload["status"] | null | undefined): ParitySchedulePayload["status"] | null {
  return value === "active" || value === "skipped" || value === "superseded" || value === "archived" ? value : null;
}

function sanitizeCompletionState(value: AttendanceCompletionState | null | undefined): AttendanceCompletionState | null {
  return value === "not-attempted"
    || value === "click-attempted"
    || value === "click-succeeded-local"
    || value === "verification-pending"
    || value === "verified-success"
    || value === "verification-unknown"
    || value === "verification-failed"
    || value === "manually-verified"
    ? value
    : null;
}

function sanitizeVerificationStatus(value: AttendanceVerificationStatus | null | undefined): AttendanceVerificationStatus | null {
  return value === "pending"
    || value === "verified-success"
    || value === "verification-unknown"
    || value === "verification-failed"
    || value === "manually-verified"
    ? value
    : null;
}

function sanitizeUuidLike(value: string): string {
  const text = String(value ?? "").trim();
  return isValidDeviceId(text)
    ? text
    : "00000000-0000-4000-8000-000000000000";
}

function isValidDeviceId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? "").trim());
}

function sanitizeIsoText(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function sanitizeNullableIsoText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sanitizeDateText(value: string | null): string | null {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
}

function parseSupabaseUrl(value: string): URL | null {
  try {
    const endpoint = new URL(value.trim());
    if (endpoint.protocol !== "https:") {
      return null;
    }

    endpoint.pathname = "/";
    endpoint.search = "";
    endpoint.hash = "";
    return endpoint;
  } catch {
    return null;
  }
}

function sanitizeStatusText(value: string | null | undefined, maxLength: number): string | null {
  const sanitized = String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, (match) => {
      try {
        const url = new URL(match);
        return `${url.protocol}//${url.host}/[redacted]`;
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .replace(/link=[^\s&]+/gi, "[redacted-link]")
    .replace(/magic=[^\s&]+/gi, "[redacted-magic]")
    .replace(/4Tredir=[^\s&]+/gi, "[redacted-redirect]")
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/apikey['":\s]+[A-Za-z0-9._-]+/gi, "apikey [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return sanitized || null;
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown parity sync error.");
  return sanitizeStatusText(raw, 240) ?? "Unknown parity sync error.";
}
