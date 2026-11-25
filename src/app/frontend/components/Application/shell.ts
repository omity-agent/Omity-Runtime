import { sva } from "styled-system/css";

export const applicationShell = sva({
  base: {
    caption: {
      display: { _compact: "block", base: "none" },
      fontSize: "interface",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    main: {
      background: "bg.canvas",
      gridArea: "main",
      height: "full",
      minHeight: "0",
      minWidth: "0",
      overflow: "hidden",
    },
    panelToggle: { display: { _compact: "inline-flex", base: "none" } },
    root: {
      "&[data-panel]": {
        _compact: {
          gridTemplateAreas: '"toolbar" "main"',
          gridTemplateRows: "auto minmax(0, 1fr)",
        },
      },
      background: "bg.default",
      color: "fg.default",
      display: "grid",
      fontFamily: "body",
      gridTemplateAreas: {
        _topNav: '"toolbar" "sidebar" "main"',
        base: '"toolbar main" "sidebar main"',
      },
      gridTemplateColumns: {
        _compact: "minmax(0, 1fr)",
        _topNav: "minmax(0, 1fr)",
        base: "auto minmax(0, 1fr)",
      },
      gridTemplateRows: {
        _topNav: "auto clamp(12rem, 28dvh, 24rem) minmax(0, 1fr)",
        base: "auto minmax(0, 1fr)",
      },
      height: "viewport",
      overflow: "hidden",
      paddingBlockEnd: "safeAreaBlockEnd",
      paddingBlockStart: "safeAreaBlockStart",
      paddingInlineEnd: "safeAreaInlineEnd",
      paddingInlineStart: "safeAreaInlineStart",
    },
    sidebar: {
      display: "flex",
      flexDirection: "column",
      gridArea: { _compact: "main", base: "sidebar" },
      minHeight: "0",
      minWidth: "0",
      overflow: "hidden",
      width: { _compact: "full", _topNav: "full", base: "appSidebar" },
    },
    toolbar: {
      alignItems: "center",
      display: "flex",
      gap: "1",
      gridArea: "toolbar",
      minWidth: "0",
      paddingBlock: { _compact: "1", base: "2" },
      paddingInline: "2",
    },
  },
  defaultVariants: { panel: "main" },
  slots: ["root", "toolbar", "panelToggle", "caption", "sidebar", "main"],
  variants: {
    panel: {
      main: { sidebar: { _compact: { display: "none" } } },
      sessions: { main: { _compact: { display: "none" } } },
    },
  },
});
