import { defineConfig } from "@pandacss/dev";

import { globalCss } from "./src/app/frontend/presentation/composites";
import { interfaceConditions } from "./src/app/frontend/presentation/conditions";
import { interfacePreset } from "./src/app/frontend/presentation/preset";

const directory = new URL("settings/interface/", import.meta.url);
export default defineConfig({
  conditions: interfaceConditions(directory),
  dependencies: ["settings/interface/*.yaml"],
  globalCss,
  include: ["./src/app/frontend/**/*.{ts,tsx}"],
  logLevel: "warn",
  outdir: "styled-system",
  preflight: true,
  presets: [interfacePreset(directory)],
  staticCss: {
    recipes: {
      badge: [{}],
      button: [{ iconOnly: ["*"], visual: ["*"] }],
      code: [{}],
      input: [{}],
    },
  },
  strictPropertyValues: true,
  strictTokens: true,
});
