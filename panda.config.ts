import { defineConfig } from "@pandacss/dev";
import base from "@pandacss/preset-base";

import {
  animationStyles,
  globalCss,
  layerStyles,
} from "./src/app/frontend/presentation/composites";
import { interfaceConditions, keyframes } from "./src/app/frontend/presentation/conditions";
import { button } from "./src/app/frontend/presentation/recipes/pressable";
import { badge, code, field, input } from "./src/app/frontend/presentation/recipes/primitives";
import { readThemeData } from "./src/app/frontend/presentation/themeData";

const directory = new URL("settings/interface/", import.meta.url);
export default defineConfig({
  conditions: interfaceConditions(directory),
  dependencies: ["settings/interface/*.yaml"],
  eject: true,
  globalCss,
  include: ["./src/app/frontend/**/*.{ts,tsx}"],
  logLevel: "warn",
  outdir: "styled-system",
  preflight: true,
  presets: [base],
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
  theme: {
    ...readThemeData(directory),
    animationStyles,
    keyframes,
    layerStyles,
    recipes: { badge, button, code, input },
    slotRecipes: { field },
  },
});
