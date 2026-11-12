import { sva } from "styled-system/css";

export const applicationShell = sva({
  base: {
    caption: {
      fontSize: "interface",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    main: {
      background: "bg.subtle",
      height: "full",
      minHeight: "0",
      minWidth: "0",
      overflow: "hidden",
    },
    root: {
      background: "bg.canvas",
      color: "fg.default",
      display: "grid",
      fontFamily: "body",
      gridTemplateColumns: {
        _topNav: "minmax(0, 1fr)",
        base: "minmax(0, 1fr)",
        lg: "auto minmax(0, 1fr)",
      },
      gridTemplateRows: {
        _topNav: { lg: "clamp(12rem, 28dvh, 24rem) minmax(0, 1fr)" },
        base: "auto minmax(0, 1fr)",
        lg: "minmax(0, 1fr)",
      },
      height: "viewport",
      overflow: "hidden",
      paddingBlockEnd: "safeAreaBlockEnd",
      paddingBlockStart: "safeAreaBlockStart",
      paddingInlineEnd: "safeAreaInlineEnd",
      paddingInlineStart: "safeAreaInlineStart",
    },
    sidebar: {
      background: "bg.panel",
      borderBlockEndColor: "border.default",
      borderBlockEndWidth: "hairline",
      borderInlineEndColor: "border.default",
      borderInlineEndWidth: { _topNav: "0", base: "0", lg: "hairline" },
      display: "grid",
      gridTemplateRows: "auto minmax(0, 1fr) auto",
      minHeight: "0",
      minWidth: "0",
      overflow: "hidden",
      width: { _topNav: "full", lg: "appSidebar" },
    },
    toolbar: {
      alignItems: "center",
      background: "bg.panel",
      borderBlockEndColor: "border.default",
      borderBlockEndWidth: "hairline",
      display: { base: "flex", lg: "none" },
      gap: "3",
      minWidth: "0",
      paddingBlock: "1",
      paddingInline: "3",
    },
  },
  defaultVariants: { panel: "main" },
  slots: ["root", "toolbar", "caption", "sidebar", "main"],
  variants: {
    panel: {
      main: { sidebar: { _compact: { display: "none" } } },
      sessions: { main: { _compact: { display: "none" } } },
    },
  },
});
