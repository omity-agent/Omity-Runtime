import { localize } from "../i18n/server";

interface ToolExecutionHandle {
  signal: AbortSignal;
  cancellationDurationMs: () => number | undefined;
  complete: () => void;
}
interface ToolExecution {
  startedAt?: number;
  cancelledAt?: number;
  controller: AbortController;
  timer?: ReturnType<typeof setInterval>;
}
type ToolExecutionsOptions = {
  now?: () => number;
} & (
  | { cancellationRequested: (callId: string) => number | undefined; pollMs: number }
  | { cancellationRequested?: undefined }
);
export class ToolExecutions {
  private readonly executions = new Map<string, ToolExecution>();
  private readonly now: () => number;
  constructor(private readonly options: ToolExecutionsOptions = {}) {
    this.now = options.now ?? Date.now;
  }
  begin(callId: string, parentSignal?: AbortSignal): ToolExecutionHandle {
    if (this.executions.has(callId)) {
      throw new Error(localize("agent:tool.alreadyRunning", { callId }));
    }
    const execution: ToolExecution = { controller: new AbortController() };
    this.executions.set(callId, execution);
    this.startPolling(callId, execution);
    if (execution.cancelledAt === undefined) {
      execution.startedAt = this.now();
    }
    const signal = parentSignal
      ? AbortSignal.any([parentSignal, execution.controller.signal])
      : execution.controller.signal;
    return {
      cancellationDurationMs: () =>
        execution.cancelledAt === undefined
          ? undefined
          : execution.startedAt === undefined
            ? 0
            : Math.max(0, execution.cancelledAt - execution.startedAt),
      complete: () => {
        if (execution.timer) {
          clearInterval(execution.timer);
        }
        if (this.executions.get(callId) === execution) {
          this.executions.delete(callId);
        }
      },
      signal,
    };
  }
  cancel(callId: string, requestedAt = this.now()) {
    const execution = this.executions.get(callId);
    if (!execution || execution.cancelledAt !== undefined) {
      return false;
    }
    execution.cancelledAt = requestedAt;
    execution.controller.abort(new Error(localize("agent:tool.manuallyCancelled")));
    return true;
  }
  close() {
    for (const execution of this.executions.values()) {
      clearInterval(execution.timer);
    }
    this.executions.clear();
  }
  private startPolling(callId: string, execution: ToolExecution) {
    const { cancellationRequested } = this.options;
    if (!cancellationRequested) {
      return;
    }
    const check = () => {
      const requestedAt = cancellationRequested(callId);
      if (requestedAt !== undefined) {
        this.cancel(callId, requestedAt);
      }
    };
    check();
    if (execution.cancelledAt !== undefined) {
      return;
    }
    execution.timer = setInterval(check, this.options.pollMs);
    execution.timer.unref();
  }
}
