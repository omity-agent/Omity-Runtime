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
        _compact: "minmax(0, 1fr)",
        _topNav: "minmax(0, 1fr)",
        base: "auto minmax(0, 1fr)",
      },
      gridTemplateRows: {
        _compact: { _topNav: "auto minmax(0, 1fr)", base: "auto minmax(0, 1fr)" },
        _topNav: "clamp(12rem, 28dvh, 24rem) minmax(0, 1fr)",
        base: "minmax(0, 1fr)",
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
      borderInlineEndWidth: { _compact: "0", _topNav: "0", base: "hairline" },
      display: "flex",
      flexDirection: "column",
      minHeight: "0",
      minWidth: "0",
      overflow: "hidden",
      width: { _compact: "full", _topNav: "full", base: "appSidebar" },
    },
    toolbar: {
      alignItems: "center",
      background: "bg.panel",
      borderBlockEndColor: "border.default",
      borderBlockEndWidth: "hairline",
      display: { _compact: "flex", base: "none" },
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
