import { localize } from "../../i18n/server";
import type { Logger } from "../../infrastructure/logging/logger";

interface HostSignalOptions {
  enabled: boolean;
  force: AbortController;
  logger: Logger;
  stopping: AbortController;
  timeoutMs: number;
}
export function wireHostSignals(options: HostSignalOptions) {
  if (!options.enabled) {
    return () => {};
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stop = (signal: NodeJS.Signals) => {
    const reason = new Error(localize("runtime:signal.received", { value0: signal }));
    if (options.stopping.signal.aborted) {
      options.force.abort(reason);
      return;
    }
    options.stopping.abort(reason);
    options.logger.warn(localize("runtime:signal.stopAtRecoveryBoundary", { value0: signal }));
    timeout = setTimeout(() => {
      options.force.abort(new Error(localize("runtime:signal.recoveryBoundaryTimeout")));
    }, options.timeoutMs);
    timeout.unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  };
}
