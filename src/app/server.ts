import { localize } from "../i18n/server";
import { applicationAssetPath } from "../infrastructure/applicationAssets";
import { createSettingsContext } from "../infrastructure/configuration/settings/context";
import { userDataDirectory } from "../infrastructure/configuration/settings/files";
import { loadAppSettings } from "../infrastructure/configuration/settings/load";
import { AccessService } from "./access/service";
import { AppController } from "./controller";
import { createHttpServer } from "./http/transport";
import { appUrl } from "./launch";
import { AppInstanceLock } from "./runtime/instanceLock";
import {
  closeAppResources,
  createShutdownLogger,
  listenForShutdownSignal,
} from "./runtime/shutdown";

interface AppServerOptions {
  root: string;
  onReady?: (url: string) => void;
}
export async function startAppServer(options: AppServerOptions) {
  const settingsContext = createSettingsContext(options.root),
    settings = loadAppSettings(settingsContext),
    { host, port } = settings.server,
    lock = AppInstanceLock.acquire(userDataDirectory()),
    shutdown = listenForShutdownSignal();
  let controller: AppController | undefined,
    failure: Error | undefined,
    server: ReturnType<typeof createHttpServer> | undefined,
    signal: Awaited<typeof shutdown.signal> | undefined;
  try {
    controller = new AppController(options.root, { settings, settingsContext });
    server = createHttpServer({
      access: new AccessService(settings, controller.database.db),
      controller,
      hostname: host,
      port,
      settings,
      staticRoot: applicationAssetPath(options.root, "dist/frontend"),
    });
    const boundPort = server.port;
    if (boundPort === undefined) {
      throw new Error(localize("application:server.portUnavailable"));
    }
    const url = appUrl(host, boundPort);
    options.onReady?.(url);
    signal = await shutdown.signal;
  } catch (error) {
    failure =
      error instanceof Error
        ? error
        : new Error(localize("application:server.startupFailed"), { cause: error });
  } finally {
    shutdown.dispose();
  }
  const logger = createShutdownLogger();
  let closeFailure: Error | undefined;
  try {
    await closeAppResources(
      {
        controller,
        releaseLock: () => lock.release(),
        server,
      },
      logger,
      signal ?? "startup-failure",
    );
  } catch (error) {
    closeFailure =
      error instanceof Error
        ? error
        : new Error(localize("application:shutdown.failed"), { cause: error });
  }
  if (failure && closeFailure) {
    throw new AggregateError(
      [failure, closeFailure],
      localize("application:server.startupAndShutdownFailed"),
    );
  }
  if (failure) {
    throw failure;
  }
  if (closeFailure) {
    throw closeFailure;
  }
}
