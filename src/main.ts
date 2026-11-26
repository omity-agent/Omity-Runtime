#!/usr/bin/env bun
// eslint-disable-next-line import/no-unassigned-import -- Decorated dependencies use reflection metadata during initialization.
import "reflect-metadata";

import { openBrowser } from "./app/launch";
import { workspaceDialogProcessEnv } from "./app/workspaceDialog/bridge";
import { localize } from "./i18n/server";
import { loadUserEnvironment } from "./infrastructure/configuration/settings/files";
import { installNetworking } from "./infrastructure/network/installNetworking";

if (process.env[workspaceDialogProcessEnv] === "1") {
  const { showNativeFolderDialog } = await import("./app/workspaceDialog/nativeFolder");
  await showNativeFolderDialog();
} else {
  loadUserEnvironment();
  const closeNetworking = installNetworking();
  try {
    const { startAppServer } = await import("./app/server");
    await startAppServer({
      onReady: (url) => {
        console.log(localize("application:launch.webStarted", { url }));
        openBrowser(url);
      },
      root: process.cwd(),
    });
  } finally {
    await closeNetworking();
  }
}
