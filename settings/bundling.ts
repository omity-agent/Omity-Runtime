import { resolve } from "node:path";

import type { UserConfig } from "vite";

import { proxyAddon } from "../scripts/proxyAddon.ts";
import { vocabularyChunks, vocabularyModulePrefix } from "../scripts/vocabularyChunks.ts";

const root = resolve(import.meta.dirname, "..");
export const frontendOutput = resolve(root, "dist/frontend");
export const databaseOutput = resolve(root, "dist/database");
export const schemaGenerationCache = resolve(root, "node_modules/.cache/schema-generation");
const compilation = {
  aot: true,
  assets: [resolve(root, "settings"), frontendOutput, databaseOutput],
  outfile: resolve(root, "dist/omity.exe"),
} satisfies Bun.CompileBuildOptions & { aot: true };
export const executableBuild = {
  compile: compilation,
  entrypoints: [resolve(root, "src/cli.ts")],
  minify: true,
  plugins: [proxyAddon],
  root,
  sourcemap: "linked",
} satisfies Bun.BuildConfig;
export const frontendBuild = {
  emptyOutDir: true,
  outDir: frontendOutput,
  rolldownOptions: {
    checks: {
      bundlerTimings: false,
    },
    output: {
      codeSplitting: {
        groups: [
          {
            name: "token-vocabulary",
            priority: 20,
            test: (id) => id.startsWith(vocabularyModulePrefix),
          },
          {
            name: "dependencies",
            test: /[/\\]node_modules[/\\]/,
          },
        ],
        maxSize: 350_000,
      },
      strictExecutionOrder: true,
    },
  },
} satisfies UserConfig["build"];
export const frontendPlugins = [vocabularyChunks(200_000)];
export const highlightWorker = {
  format: "es",
} satisfies UserConfig["worker"];
