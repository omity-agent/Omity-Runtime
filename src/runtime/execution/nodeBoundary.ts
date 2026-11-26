import { localize } from "../../i18n/server";
import { prepareGraphInput } from "../appends";
import { type HostContext, readGraphState } from "../context";
import { waitBeforeModelRetry } from "../retry";
import { type ActiveRun, CanceledRunError, cancelRun, finishRun, setRunStatus } from "../run";
import { completeActiveStream, createStreamLogState, discardActiveStream } from "../stream";
import { streamGraphSegment } from "../stream/graph";
import { recordToolStarted } from "../stream/model";
import { isRetryableModelError } from "../transientErrors";
import { pauseForStop, waitIfPaused } from "./pause";
import { waitAfterCompletedStep } from "./step";

type AgentOperation = "model" | "tools";
export async function runGraphUntilBoundary(
  ctx: HostContext,
  run: ActiveRun,
  initialStepping: boolean,
) {
  const [item] = run.items,
    config = {
      configurable: { thread_id: run.threadId },
      interruptAfter: ["request_model", "invoke_tool", "invoke_tool_batch"] as string[],
      interruptBefore: ["model_request", "tools"] as string[],
      recursionLimit: ctx.settings.agent.recursionLimit,
    };
  let retries = 0,
    steppedOperation: AgentOperation | undefined,
    synchronizeHistory = false,
    stepping = initialStepping;
  const streamState = createStreamLogState();
  for (;;) {
    ctx.assertLease?.();
    const state = await readGraphState(ctx.graph, config);
    if (synchronizeHistory && state && state.values.messages.length > 0) {
      await ctx.db.syncHistory(ctx.sessionId, state.values.messages);
      completeActiveStream(streamState);
      ctx.observer?.changed?.(ctx.sessionId);
    }
    const control = ctx.db.control(ctx.sessionId);
    if (control === "cancel") {
      cancelRun(ctx, run);
      return;
    }
    if (pauseForStop(ctx, run)) {
      return;
    }
    if (control === "pause" || control === "pause_cancel") {
      const advance = await waitIfPaused(ctx, run);
      if (!advance) {
        return;
      }
      stepping = advance === "step";
      steppedOperation = undefined;
    } else if (control === "running") {
      stepping = false;
      steppedOperation = undefined;
    } else if (!stepping) {
      stepping = true;
      steppedOperation = undefined;
    }
    const next = state ? nextOperation(state.next) : undefined;
    if (next && stepIsComplete(steppedOperation, next)) {
      const advance = await waitAfterCompletedStep(ctx, run);
      if (!advance) {
        return;
      }
      stepping = advance === "step";
      steppedOperation = undefined;
    }
    const input = prepareGraphInput(ctx, run, state),
      operation = input === null ? next : undefined;
    if (input === null && state?.next.length === 0) {
      finishRun(ctx, run, state.values.messages, state.values.hookPlan);
      return;
    }
    const cursor = ctx.db.eventCursor();
    if (operation && state) {
      announceOperation(ctx, item.id, operation, state.values.messages);
    }
    try {
      const completed = await streamGraphSegment(ctx, item.id, input, config, streamState);
      if (!completed) {
        discardActiveStream(ctx, streamState, item.id, cursor);
        steppedOperation = undefined;
      } else if (stepping && operation) {
        steppedOperation ??= operation;
      }
      retries = 0;
      synchronizeHistory = true;
    } catch (error) {
      discardActiveStream(ctx, streamState, item.id, cursor);
      synchronizeHistory = false;
      if (!isRetryableModelError(error)) {
        throw error;
      }
      retries += 1;
      const retry = await waitBeforeModelRetry(ctx, run, error, retries, {
        cancel: () => {
          cancelRun(ctx, run);
          return Promise.reject(new CanceledRunError(localize("runtime:boundary.cancelled")));
        },
        pause: async () => (await waitIfPaused(ctx, run)) !== false,
        stop: () => setRunStatus(ctx, run, "paused"),
      });
      if (!retry) {
        return;
      }
    }
  }
}
function nextOperation(next: string[]): AgentOperation | undefined {
  const operations = [
    ...(next.includes("model_request") ? (["model"] as const) : []),
    ...(next.includes("tools") ? (["tools"] as const) : []),
  ];
  if (operations.length > 1) {
    throw new Error(localize("runtime:boundary.modelAndToolsConcurrent"));
  }
  return operations[0];
}
function stepIsComplete(completed: AgentOperation | undefined, next: AgentOperation) {
  return completed === "model" || (completed === "tools" && next === "model");
}
function announceOperation(
  ctx: HostContext,
  inputId: number,
  operation: AgentOperation,
  messages: Parameters<typeof recordToolStarted>[1],
) {
  ctx.observer?.activity?.(ctx.sessionId, operation === "tools" ? "tool" : "waiting");
  if (operation === "tools") {
    recordToolStarted(ctx, messages, inputId);
  }
}
