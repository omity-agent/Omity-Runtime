import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { localize } from "../src/i18n/server";
import { isProcessRunning } from "../src/infrastructure/processLiveness";
import { databaseOutput, schemaGenerationCache } from "./distribution";

const database = {
  name: "database",
  schema: "./src/infrastructure/database/schema/index.ts",
};
export async function generateDatabaseSchema(root: string) {
  await mkdir(schemaGenerationCache, { recursive: true });
  const entries = await readdir(schemaGenerationCache, { withFileTypes: true });
  await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          /^[1-9]\d*$/u.test(entry.name) &&
          !isProcessRunning(Number(entry.name)),
      )
      .map((entry) =>
        rm(join(schemaGenerationCache, entry.name), { force: true, recursive: true }),
      ),
  );
  const staging = join(schemaGenerationCache, process.pid.toString());
  await rm(staging, { force: true, recursive: true });
  try {
    const child = Bun.spawn(
        [
          process.execPath,
          "x",
          "drizzle-kit",
          "generate",
          "--dialect=sqlite",
          `--schema=${database.schema}`,
          `--out=${staging}`,
        ],
        { cwd: root, stderr: "inherit", stdout: "inherit" },
      ),
      exitCode = await child.exited;
    if (exitCode !== 0) {
      throw new Error(
        localize("build:databaseGenerationFailed", {
          code: exitCode.toString(),
          name: database.name,
        }),
      );
    }
    const schema = await readGeneratedSchema(staging),
      asset = join(staging, "schema.sql");
    await writeFile(
      asset,
      schema.replaceAll(
        /CREATE (?<kind>TABLE|(?:UNIQUE )?INDEX) /gu,
        "CREATE $<kind> IF NOT EXISTS ",
      ),
    );
    await mkdir(databaseOutput, { recursive: true });
    await rename(asset, join(databaseOutput, "schema.sql"));
  } finally {
    await rm(staging, { force: true, recursive: true });
  }
}
async function readGeneratedSchema(staging: string) {
  const entries = await readdir(staging, { withFileTypes: true });
  if (entries.length !== 1 || !entries[0]!.isDirectory()) {
    throw new Error(localize("build:databaseDirectoryInvalid", { name: database.name }));
  }
  const directory = join(staging, entries[0]!.name),
    generated = await readdir(directory, { withFileTypes: true }),
    expected = ["migration.sql", "snapshot.json"];
  if (
    generated.length !== expected.length ||
    generated.some((entry) => !entry.isFile() || !expected.includes(entry.name))
  ) {
    throw new Error(localize("build:databaseFilesInvalid", { name: database.name }));
  }
  return readFile(join(directory, "migration.sql"), "utf8");
}
