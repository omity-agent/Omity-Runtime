import pMap from "p-map";

import { captureError } from "../../failures/details";
import { localize } from "../../i18n/server";
import { Logger } from "../../infrastructure/logging/logger";
type ShutdownSignal = "SIGINT" | "SIGTERM";
type ShutdownReason = ShutdownSignal | "startup-failure";
interface ShutdownResources {
  controller?: { close: () => Promise<void> };
  releaseLock: () => void;
  server?: Pick<Bun.Server<undefined>, "stop">;
}
interface ShutdownLogger {
  error: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
}
export function createShutdownLogger() {
  return new Logger("debug");
}
export async function closeControllerResources(
  ...resources: { close: () => Promise<void> | void }[]
) {
  await pMap(resources, (resource) => resource.close(), { concurrency: 1, stopOnError: false });
}
export function listenForShutdownSignal() {
  const waiting = Promise.withResolvers<ShutdownSignal>(),
    onSigint = () => finish("SIGINT"),
    onSigterm = () => finish("SIGTERM"),
    removeListeners = () => {
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
    },
    finish = (signal: ShutdownSignal) => {
      removeListeners();
      waiting.resolve(signal);
    };
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  return {
    dispose: removeListeners,
    signal: waiting.promise,
  };
}
export async function closeAppResources(
  resources: ShutdownResources,
  logger: ShutdownLogger,
  reason: ShutdownReason,
) {
  const startedAt = Date.now(),
    failures: unknown[] = [];
  logger.info(localize("application:shutdown.started"), { reason });
  await closeStep(
    logger,
    localize("application:shutdown.httpServer"),
    () => resources.server?.stop(true),
    failures,
  );
  await closeStep(
    logger,
    localize("application:shutdown.hostResources"),
    () => resources.controller?.close(),
    failures,
  );
  await closeStep(
    logger,
    localize("application:shutdown.instanceLock"),
    resources.releaseLock,
    failures,
  );
  if (failures.length > 0) {
    logger.error(localize("application:shutdown.completedWithFailures"), {
      durationMs: Date.now() - startedAt,
      errorCount: failures.length,
      errors: failures.map(captureError),
    });
    throw new AggregateError(failures, localize("application:shutdown.failed"));
  }
  logger.info(localize("application:shutdown.completed"), {
    durationMs: Date.now() - startedAt,
  });
}
async function closeStep(
  logger: ShutdownLogger,
  name: string,
  close: () => unknown,
  failures: unknown[],
) {
  logger.info(localize("application:shutdown.stepStarted", { stepName: name }));
  const startedAt = Date.now();
  try {
    await close();
    logger.info(localize("application:shutdown.stepCompleted", { stepName: name }), {
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    failures.push(error);
    logger.error(localize("application:shutdown.stepFailed", { stepName: name }), {
      durationMs: Date.now() - startedAt,
      error: captureError(error),
    });
  }
}
