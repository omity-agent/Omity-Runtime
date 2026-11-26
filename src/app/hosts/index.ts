import { once } from "es-toolkit";
import pMap from "p-map";

import { ToolExecutions } from "../../agent/toolExecutions";
import { captureError, type ErrorDetails } from "../../failures/details";
import { localize } from "../../i18n/server";
import type { SettingsContext } from "../../infrastructure/configuration/settings/context";
import type { AgentDatabase } from "../../infrastructure/database/agentDatabase";
import { HostNotifications } from "../../runtime/execution/notifications";
import type { ControlCommand, HostActivity } from "../../types";
import type { AppMcp } from "../runtime/resources/toolPool";
import { runSessionHost, stopAtRecoveryBoundary } from "./execution";
import { type AppHostEvents, createHostObserver, type RunningHost } from "./observation";

export type { AppHostEvents } from "./observation";
export class AppHosts {
  private readonly running = new Map<string, RunningHost>();
  private readonly scheduled = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly errors = new Map<string, ErrorDetails>();
  private readonly mutating = new Set<string>();
  private closing = false;
  constructor(
    private readonly events: AppHostEvents,
    private readonly db: AgentDatabase,
    private readonly shutdownTimeoutMs: number,
    readonly mcp: AppMcp,
    private readonly settingsContext: SettingsContext,
  ) {}
  has(sessionId: string) {
    return this.running.has(sessionId);
  }
  error(sessionId: string) {
    return this.errors.get(sessionId) ?? null;
  }
  activity(sessionId: string): HostActivity {
    return this.running.get(sessionId)?.activity ?? "idle";
  }
  clearError(sessionId: string) {
    this.errors.delete(sessionId);
  }
  scheduleStart(sessionId: string, workspace: string) {
    if (this.closing || this.isBound(sessionId)) {
      return;
    }
    const timer = setTimeout(() => void this.startScheduled(sessionId, workspace), 0);
    this.scheduled.set(sessionId, timer);
  }
  ensure(sessionId: string, workspace: string) {
    if (this.closing) {
      return Promise.reject(new Error(localize("application:hosts.appClosing")));
    }
    if (this.mutating.has(sessionId)) {
      return Promise.reject(this.sessionChanging(sessionId));
    }
    this.cancelScheduledStart(sessionId);
    const existing = this.running.get(sessionId);
    if (existing) {
      return existing.ready;
    }
    this.errors.delete(sessionId);
    const force = new AbortController(),
      stopping = new AbortController(),
      ready = Promise.withResolvers<void>(),
      notifications = new HostNotifications(),
      executions = new ToolExecutions({
        cancellationRequested: (callId) => this.db.toolCancellation(sessionId, callId),
      }),
      hostPromise = runSessionHost({
        controller: force,
        db: this.db,
        mcp: this.mcp,
        notifications,
        observer: createHostObserver(this.events, this.running, force),
        ready: ready.resolve,
        sessionId,
        settingsContext: this.settingsContext,
        stopping: stopping.signal,
        toolExecutions: executions,
        workspace,
      }),
      done = this.finishHost(hostPromise, sessionId, force.signal, ready);
    this.running.set(sessionId, {
      activity: "idle",
      done,
      executions,
      force,
      notifications,
      ready: ready.promise,
      stopping,
    });
    return ready.promise;
  }
  notify(sessionId: string, control?: ControlCommand) {
    this.running.get(sessionId)?.notifications.notify(control);
  }
  cancelTool(sessionId: string, callId: string, requestedAt: number) {
    this.running.get(sessionId)?.executions.cancel(callId, requestedAt);
  }
  async withStoppedHost<Result>(
    sessionId: string,
    workspace: string | undefined,
    operation: () => Result,
  ) {
    if (this.mutating.has(sessionId)) {
      throw this.sessionChanging(sessionId);
    }
    const restart = workspace !== undefined && this.isBound(sessionId);
    this.mutating.add(sessionId);
    try {
      this.cancelScheduledStart(sessionId);
      const host = this.running.get(sessionId);
      if (host) {
        host.force.abort(new Error(localize("application:hosts.stopRequested")));
        await host.done;
      } else {
        await this.mcp.discardSession(sessionId);
      }
      return operation();
    } finally {
      this.mutating.delete(sessionId);
      if (restart) {
        this.scheduleStart(sessionId, workspace);
      }
    }
  }
  close = once(async () => {
    this.closing = true;
    await using resources = new AsyncDisposableStack();
    resources.defer(() => this.mcp.close());
    for (const timer of this.scheduled.values()) {
      clearTimeout(timer);
    }
    this.scheduled.clear();
    const hosts = [...this.running.entries()];
    for (const [sessionId, host] of hosts) {
      host.stopping.abort(new Error(localize("application:hosts.appClosed")));
      this.events.changed(sessionId);
    }
    await pMap(hosts, ([, host]) => stopAtRecoveryBoundary(host, this.shutdownTimeoutMs), {
      stopOnError: false,
    });
  });
  private async finishHost(
    hostPromise: Promise<unknown>,
    sessionId: string,
    signal: AbortSignal,
    ready: PromiseWithResolvers<void>,
  ) {
    let failure: unknown;
    try {
      await hostPromise;
    } catch (error: unknown) {
      if (!signal.aborted || error !== signal.reason) {
        failure = error;
      }
    } finally {
      try {
        await this.mcp.discardSession(sessionId);
      } catch (error) {
        failure =
          failure === undefined
            ? error
            : new AggregateError([failure, error], localize("application:hosts.shutdownFailed"));
      }
      if (failure !== undefined) {
        const error = captureError(failure);
        this.errors.set(sessionId, error);
        this.events.failure(sessionId, error);
        ready.reject(failure);
      } else if (signal.aborted) {
        ready.reject(signal.reason);
      }
      this.running.get(sessionId)?.executions.close();
      this.running.delete(sessionId);
      this.events.changed(sessionId);
    }
  }
  private isBound(sessionId: string) {
    return this.running.has(sessionId) || this.scheduled.has(sessionId);
  }
  private sessionChanging(sessionId: string) {
    return new Error(localize("application:hosts.sessionChanging", { sessionId }));
  }
  private async startScheduled(sessionId: string, workspace: string) {
    this.scheduled.delete(sessionId);
    try {
      await this.ensure(sessionId, workspace);
    } catch {
      this.events.changed(sessionId);
    }
  }
  private cancelScheduledStart(sessionId: string) {
    const timer = this.scheduled.get(sessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.scheduled.delete(sessionId);
    }
  }
}
