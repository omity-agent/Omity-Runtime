import { css } from "styled-system/css";

export const composerFrame = css({
  background: "surface",
  borderBlockStartWidth: "hairline",
  borderTopColor: "line",
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
  minWidth: "zero",
  width: { base: "full", md: "composerActions" },
});
export const composerControls = css({
  alignItems: "center",
  borderWidth: "zero",
  display: "flex",
  flexWrap: "wrap",
  gap: "1",
  justifyContent: "flex-end",
  minHeight: "controlTarget",
  minWidth: "zero",
  order: { base: 1, md: 0 },
  padding: "zero",
  width: "full",
});
export const runtimeControls = css({
  borderWidth: "zero",
  display: "flex",
  flexShrink: 0,
  gap: "1",
  justifyContent: "flex-end",
  minWidth: "zero",
  padding: "zero",
  width: "runtimeControls",
});
export const composerRole = css({
  alignItems: "center",
  color: "mutedStrong",
  display: { base: "none", md: "flex" },
  justifyContent: "flex-end",
  marginBlockStart: { md: "auto" },
  minHeight: "controlTarget",
  paddingInlineEnd: { _coarse: "3", base: "1.5" },
});
