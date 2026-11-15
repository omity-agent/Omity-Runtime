import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { build } from "vite";

import { executableBuild, frontendOutput } from "../settings/bundling";
import { localize } from "../src/i18n/server";
import { prepareMagikaAssets } from "./magikaModel";
import { generateDatabaseSchema } from "./schemaAsset";

const root = resolve(import.meta.dir, ".."),
  frontendPublicCache = resolve(root, "dist/frontend-public"),
  command = process.argv.at(2);
if (command !== undefined && command !== "--test" && command !== "--benchmark-mcp") {
  throw new Error(localize("build:unknownArgument", { command }));
}
await generateDatabaseSchema(root);
const run =
  command === "--test"
    ? runTests
    : command === "--benchmark-mcp"
      ? runMcpBenchmark
      : buildApplication;
await run();
async function buildApplication() {
  await rm(frontendOutput, { force: true, recursive: true });
  const frontendPublicDirectory = await prepareMagikaAssets(frontendPublicCache);
  await build({
    configFile: resolve(root, "vite.config.ts"),
    logLevel: "warn",
    publicDir: frontendPublicDirectory,
  });
  await mkdir(resolve(root, "dist"), { recursive: true });
  const executable = await Bun.build(executableBuild);
  if (!executable.success) {
    throw new AggregateError(executable.logs, localize("build:executableBuildFailed"));
  }
}
async function runTests() {
  const child = Bun.spawn([process.execPath, "test", ...process.argv.slice(3)], {
      cwd: root,
      stderr: "inherit",
      stdout: "inherit",
    }),
    exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(localize("build:testsFailed", { code: exitCode.toString() }));
  }
}
async function runMcpBenchmark() {
  const child = Bun.spawn([process.execPath, "run", "scripts/benchmark/runLatency.ts"], {
      cwd: root,
      stderr: "inherit",
      stdout: "inherit",
    }),
    exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(localize("build:testsFailed", { code: exitCode.toString() }));
  }
}
