import { definePreset } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";
import neutral from "@park-ui/panda-preset/colors/neutral";
import { deepmerge } from "deepmerge-ts";
import { pick } from "es-toolkit";

import { animationStyles, layerStyles } from "./composites";
import { keyframes } from "./conditions";
import { button } from "./recipes/pressable";
import { badge, code, input } from "./recipes/primitives";
import { readThemeData } from "./themeData";

const park = createPreset({ accentColor: neutral, grayColor: neutral, radius: "none" }),
  inherited = park.theme?.extend;

export function interfacePreset(directory: URL) {
  if (!inherited?.slotRecipes) {
    throw new Error("Park UI preset must provide its theme and slot recipes");
  }
  return definePreset({
    ...park,
    globalCss: {
      ...park.globalCss,
      "*::selection": { background: "bg.selection" },
    },
    name: "omity",
    theme: {
      extend: {
        ...deepmerge(inherited, {
          ...readThemeData(directory),
          animationStyles,
          keyframes,
          layerStyles,
        }),
        recipes: { badge, button, code, input },
        slotRecipes: pick(inherited.slotRecipes, ["field", "switchRecipe"]),
      },
    },
  });
}
