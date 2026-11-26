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
}
interface ToolExecutionsOptions {
  now?: () => number;
  cancellationRequested?: (callId: string) => number | undefined;
}
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
    const requestedAt = this.options.cancellationRequested?.(callId);
    if (requestedAt === undefined) {
      execution.startedAt = this.now();
    } else {
      this.cancel(callId, requestedAt);
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
    this.executions.clear();
  }
}
