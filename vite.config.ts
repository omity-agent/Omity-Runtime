import { resolve } from "node:path";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { frontendBuild, frontendPlugins, highlightWorker } from "./scripts/distribution.ts";
import { yamlAssets } from "./scripts/yamlAssets.ts";

const root = import.meta.dirname;
export default defineConfig({
  base: "./",
  build: frontendBuild,
  plugins: [
    yamlAssets,
    ...frontendPlugins,
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  resolve: {
    alias: {
      "styled-system": resolve(root, "styled-system"),
    },
    dedupe: ["@codemirror/state", "@codemirror/view"],
  },
  root: "src/app/frontend",
  server: {
    strictPort: false,
  },
  worker: highlightWorker,
});
