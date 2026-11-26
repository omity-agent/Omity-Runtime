import { captureError } from "../../failures/details";
import { localize } from "../../i18n/server";
import { hasForcePauseRequest } from "../../infrastructure/database/records/execution/control";
import { findMcpStdioUnavailable } from "../../infrastructure/mcp/client/availability";
import { type HostContext, waitForWake } from "../context";
import { type ActiveRun, CanceledRunError, cancelRun, pauseFailedRun, setRunStatus } from "../run";

export function watchForcePause(ctx: HostContext) {
  const operation = new AbortController(),
    done = new AbortController(),
    signal = AbortSignal.any([ctx.controller.signal, operation.signal]),
    until = AbortSignal.any([signal, done.signal]);
  let interrupted = false;
  const watching = watch().catch((error: unknown) => {
    operation.abort(error);
    return { error };
  });
  return {
    interrupted: () => interrupted,
    signal,
    async [Symbol.asyncDispose]() {
      done.abort();
      const failure = await watching;
      if (failure) {
        throw failure.error;
      }
    },
  };
  async function watch() {
    while (!until.aborted) {
      if (hasForcePauseRequest(ctx.db.db, ctx.sessionId)) {
        interrupted = true;
        operation.abort(new Error(localize("runtime:pause.forced")));
        return;
      }
      await waitForWake(ctx, ctx.settings.host.pollMs, until);
    }
  }
}
export function pauseForStop(ctx: HostContext, run: ActiveRun) {
  if (!ctx.stopping?.aborted && !ctx.controller.signal.aborted) {
    return false;
  }
  setRunStatus(ctx, run, "paused");
  return true;
}
export function pauseForMcpUnavailable(ctx: HostContext, run: ActiveRun, error: unknown) {
  const unavailable = findMcpStdioUnavailable(error);
  if (!unavailable) {
    return false;
  }
  const details = captureError(unavailable);
  pauseFailedRun(ctx, run, details);
  ctx.logger.warn(localize("runtime:pause.mcpUnavailable"), {
    inputId: run.items[0].id,
    server: unavailable.serverName,
  });
  return true;
}
export async function waitIfPaused(ctx: HostContext, run: ActiveRun) {
  let pauseLogged = false;
  for (;;) {
    if (pauseForStop(ctx, run)) {
      return false;
    }
    const control = ctx.db.control(ctx.sessionId);
    if (control === "pause_cancel") {
      setRunStatus(ctx, run, "paused");
      ctx.controller.abort(new CanceledRunError(localize("runtime:pause.cancelled")));
      ctx.logger.warn(localize("runtime:pause.cancelledAndHostClosed"), {
        inputId: run.items[0].id,
      });
      return false;
    }
    if (control === "cancel") {
      cancelRun(ctx, run);
      throw new CanceledRunError(localize("runtime:pause.runCancelled"));
    }
    if (control === "running" || control === "step") {
      setRunStatus(ctx, run, "running");
      return control;
    }
    if (!pauseLogged) {
      setRunStatus(ctx, run, "paused");
      ctx.logger.info(localize("runtime:pause.waitingForResume"), {
        inputId: run.items[0].id,
      });
      pauseLogged = true;
    }
    await waitForWake(ctx, ctx.settings.host.pausePollMs);
  }
}
