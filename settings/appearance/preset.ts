import { definePreset } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";
import neutral from "@park-ui/panda-preset/colors/neutral";
import { deepmerge } from "deepmerge-ts";
import { pick } from "es-toolkit";

import { colorRoles, colorScale } from "./colorTokens";
import { animationStyles, layerStyles } from "./composites";
import { keyframes } from "./conditions";
import { adaptiveMetrics, dimensions } from "./metrics";
import { button } from "./recipes/pressable";
import { badge, code, input } from "./recipes/primitives";
import { textStyles, typefaces } from "./typography";

const park = createPreset({ accentColor: neutral, grayColor: neutral, radius: "none" }),
  inherited = park.theme?.extend;

if (!inherited?.slotRecipes) {
  throw new Error("Park UI preset must provide its theme and slot recipes");
}

export const interfacePreset = definePreset({
  ...park,
  globalCss: {
    ...park.globalCss,
    "*::selection": { background: "bg.selection" },
  },
  name: "omity",
  theme: {
    extend: {
      ...deepmerge(inherited, {
        animationStyles,
        keyframes,
        layerStyles,
        semanticTokens: { ...adaptiveMetrics, colors: colorRoles },
        textStyles,
        tokens: { ...dimensions, colors: colorScale, fonts: typefaces },
      }),
      recipes: { badge, button, code, input },
      slotRecipes: pick(inherited.slotRecipes, ["field", "switchRecipe"]),
    },
  },
});
