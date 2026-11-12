import { Database } from "bun:sqlite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { applicationAssetPath } from "../../../src/infrastructure/applicationAssets";
import { createSettingsContext } from "../../../src/infrastructure/configuration/settings/context";
import { initializeDatabase } from "../../../src/infrastructure/database/sqlite/initialization";

using database = new Database(":memory:");
initializeDatabase(database);
const context = createSettingsContext(),
  frontend = applicationAssetPath(
    process.cwd(),
    "tests/app/frontend/composition/applicationShell.html",
  );
console.log(
  JSON.stringify({
    frontend: await Bun.file(frontend).text(),
    settings: await readFile(join(context.defaultsDirectory, "main.yaml"), "utf8"),
    standalone: Bun.isStandaloneExecutable,
    tables: database
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map(({ name }) => name),
  }),
);
