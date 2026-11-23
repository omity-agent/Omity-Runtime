import { writeSync } from "node:fs";

import { AsyncFileDialog } from "@bindrs/rfd";

import { localize } from "../../i18n/server";

export async function showNativeFolderDialog() {
  const directory = await new AsyncFileDialog()
    .setTitle(localize("application:workspaceDialog.title"))
    .pickFolder();
  writeSync(1, JSON.stringify(directory?.path() ?? null));
}
