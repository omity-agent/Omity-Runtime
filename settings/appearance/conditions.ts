import { defineConditions } from "@pandacss/dev";

export const compactViewport = "(width < 64rem)";

export const conditions = defineConditions({
  extend: {
    coarse: "@media (pointer: coarse)",
    compact: `@media ${compactViewport}`,
    hover: {
      "@media (hover: hover) and (pointer: fine)": {
        "&:is(:hover, [data-hover]):not(:disabled, [data-disabled])": "@slot",
      },
    },
    largeCanvas: "@media (min-width: 160rem) and (min-height: 90rem)",
    short: "@media (max-height: 40rem)",
    topNav: "@media (max-aspect-ratio: 1 / 1)",
  },
});
export const keyframes = {
  detailCollapse: {
    from: { opacity: "1", transform: "translate3d(0, 0, 0)" },
    to: { opacity: "0", transform: "translate3d(0, 0.375rem, 0)" },
  },
  detailExpand: {
    from: { opacity: "0", transform: "translate3d(0, 0.375rem, 0)" },
    to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
  },
};
