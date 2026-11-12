import { defineConfig } from "@pandacss/dev";

import { globalCss } from "./settings/appearance/composites";
import { conditions } from "./settings/appearance/conditions";
import { interfacePreset } from "./settings/appearance/preset";

export default defineConfig({
  conditions,
  globalCss,
  include: ["./src/app/frontend/**/*.{ts,tsx}"],
  logLevel: "warn",
  outdir: "styled-system",
  preflight: true,
  presets: [interfacePreset],
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
