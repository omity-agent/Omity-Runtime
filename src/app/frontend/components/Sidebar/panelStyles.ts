import { css } from "styled-system/css";

export const panel = css({
  alignItems: "center",
  background: "sidebar",
  borderBlockEndWidth: "hairline",
  borderBottomColor: "line",
  display: "grid",
  gap: "2",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  minHeight: { _coarse: "14", _compact: "14", base: "12" },
  paddingInline: "3",
});
export const brand = css({ color: "text", textStyle: "sidebarBrand" });
export const total = css({ color: "muted", textStyle: "sidebarCount" });
export const newButton = css({
  borderColor: "line",
  height: "controlTarget",
  paddingInline: "2.5",
});
export const collections = css({
  alignContent: "start",
  display: "grid",
  minHeight: "zero",
  minWidth: "zero",
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarGutter: "stable",
  touchAction: "pan-y",
});
export const section = css({
  borderBlockEndWidth: "hairline",
  borderBottomColor: "line",
  display: "grid",
  minWidth: "zero",
});
export const heading = css({
  alignItems: "center",
  color: "mutedStrong",
  display: "flex",
  fontSize: "metadata",
  gap: "2",
  minHeight: "controlTarget",
  minWidth: "zero",
  paddingBlock: "1.5",
  paddingInline: "3",
});
export const title = css({
  flexGrow: 1,
  minWidth: "zero",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const list = css({
  minWidth: "zero",
  paddingInline: "2",
});
