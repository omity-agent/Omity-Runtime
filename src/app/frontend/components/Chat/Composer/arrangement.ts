import { css } from "styled-system/css";

export const composerFrame = css({
  background: "bg.default",
  borderBlockStartWidth: "hairline",
  borderTopColor: "border.default",
  display: "grid",
  gap: { _short: "2", base: "3" },
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    md: "minmax(0, 1fr) auto",
  },
  padding: { _short: "2", base: "3", lg: "6", md: "4" },
  width: "full",
});
export const composerActions = css({
  display: "flex",
  flexDirection: "column",
  gap: "3",
  height: "full",
  justifyContent: "space-between",
  minWidth: "0",
  width: { base: "full", md: "composerActions" },
});
export const composerControls = css({
  alignItems: "center",
  borderWidth: "0",
  display: "flex",
  flexWrap: "wrap",
  gap: "1",
  justifyContent: "flex-end",
  minHeight: "controlTarget",
  minWidth: "0",
  order: { base: 1, md: 0 },
  padding: "0",
  width: "full",
});
export const runtimeControls = css({
  borderWidth: "0",
  display: "flex",
  flexShrink: 0,
  gap: "1",
  justifyContent: "flex-end",
  minWidth: "0",
  padding: "0",
  width: "runtimeControls",
});
export const composerRole = css({
  alignItems: "center",
  color: "fg.muted",
  display: { base: "none", md: "flex" },
  justifyContent: "flex-end",
  minHeight: "controlTarget",
  paddingInlineEnd: { _coarse: "3", base: "1.5" },
});
