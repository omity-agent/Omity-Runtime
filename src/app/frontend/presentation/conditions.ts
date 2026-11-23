import { defineConditions } from "@pandacss/dev";

import { readViewportQueries } from "./themeData";

export function interfaceConditions(directory: URL) {
  return defineConditions({
    extend: {
      ...Object.fromEntries(
        Object.entries(readViewportQueries(directory)).map(([name, query]) => [
          name,
          `@media ${query}`,
        ]),
      ),
      hover: {
        "@media (hover: hover) and (pointer: fine)": {
          "&:is(:hover, [data-hover]):not(:disabled, [data-disabled])": "@slot",
        },
      },
    },
  });
}
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
