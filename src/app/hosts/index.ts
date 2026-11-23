import { once } from "es-toolkit";
import pMap from "p-map";

import { captureError, type ErrorDetails } from "../../failures/details";
import { runHostSession } from "../../host";
import { localize } from "../../i18n/server";
import type { SettingsContext } from "../../infrastructure/configuration/settings/context";
import type { ProcessOwner } from "../../infrastructure/process/ownership";
import type { HostActivity } from "../../types";
import type { AppMcp } from "../runtime/resources/toolPool";
import { type AppHostEvents, createHostObserver, type RunningHost } from "./observation";

export type { AppHostEvents } from "./observation";
const noToolCancellation: RunningHost["cancelTool"] = () => false;
export class AppHosts {
  private readonly running = new Map<string, RunningHost>();
  private readonly scheduled = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly errors = new Map<string, ErrorDetails>();
  private closing = false;
  constructor(
    private readonly appRoot: string,
    private readonly events: AppHostEvents,
    private readonly owner: ProcessOwner,
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
    this.cancelScheduledStart(sessionId);
    if (this.closing) {
      return Promise.reject(new Error(localize("application:hosts.appClosing")));
    }
    const existing = this.running.get(sessionId);
    if (existing) {
      return existing.ready;
    }
    this.errors.delete(sessionId);
    const force = new AbortController(),
      stopping = new AbortController(),
      ready = Promise.withResolvers<undefined>();
    let initialized = false,
      cancelTool = noToolCancellation;
    const hostPromise = runHostSession({ kind: "load", sessionId }, this.appRoot, {
        controller: force,
        cwd: workspace,
        mcp: (id, profiles, definition) =>
          this.mcp.loadSession(id, profiles, definition.prefix.tools, workspace),
        observer: createHostObserver(this.events, this.running, force),
        onReady: (controls) => {
          cancelTool = (callId) => controls.cancelTool(callId);
          initialized = true;
          ready.resolve();
        },
        owner: this.owner,
        quiet: true,
        settingsContext: this.settingsContext,
        stoppingController: stopping,
        wake: (delayMs) => this.events.wait(sessionId, delayMs),
      }),
      done = this.finishHost(hostPromise, sessionId, force, () => initialized, ready);
    this.running.set(sessionId, {
      activity: "idle",
      cancelTool: (callId) => cancelTool(callId),
      done,
      force,
      ready: ready.promise,
      stopping,
    });
    return ready.promise;
  }
  cancelTool(sessionId: string, callId: string) {
    const host = this.running.get(sessionId);
    return host?.cancelTool(callId) ?? false;
  }
  async stop(sessionId: string) {
    this.cancelScheduledStart(sessionId);
    const host = this.running.get(sessionId);
    if (!host) {
      return;
    }
    host.force.abort(new Error(localize("application:hosts.stopRequested")));
    this.events.changed(sessionId);
    await host.done;
  }
  async withStoppedHost(sessionId: string, workspace: string, operation: () => void) {
    const restart = this.isBound(sessionId);
    await this.stop(sessionId);
    try {
      operation();
    } finally {
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
    await pMap(hosts, ([, host]) => this.stopAtDeadline(host), { stopOnError: false });
  });
  private async finishHost(
    hostPromise: Promise<unknown>,
    sessionId: string,
    force: AbortController,
    isInitialized: () => boolean,
    ready: PromiseWithResolvers<undefined>,
  ) {
    let failure: unknown;
    try {
      await hostPromise;
    } catch (error: unknown) {
      failure = error;
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
        if (!isInitialized()) {
          ready.reject(failure);
        }
      }
      if (this.running.get(sessionId)?.force === force) {
        this.running.delete(sessionId);
      }
      this.events.changed(sessionId);
    }
  }
  private async stopAtDeadline(host: RunningHost) {
    const deadline = Promise.withResolvers<false>(),
      timer = setTimeout(() => {
        deadline.resolve(false);
      }, this.shutdownTimeoutMs);
    try {
      const stopped = await Promise.race([host.done.then(() => true), deadline.promise]);
      if (!stopped) {
        host.force.abort(new Error(localize("application:hosts.recoveryBoundaryTimeout")));
      }
      await host.done;
    } finally {
      clearTimeout(timer);
    }
  }
  private isBound(sessionId: string) {
    return this.running.has(sessionId) || this.scheduled.has(sessionId);
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
