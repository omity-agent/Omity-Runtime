import { css } from "styled-system/css";

export const panel = css({
  alignItems: "center",
  background: "bg.panel",
  borderBlockEndWidth: "hairline",
  borderBottomColor: "border.default",
  display: "grid",
  gap: "2",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  minHeight: { _coarse: "14", _compact: "14", base: "12" },
  paddingInline: "3",
});
export const brand = css({ color: "fg.default", textStyle: "sidebarBrand" });
export const total = css({ color: "fg.subtle", textStyle: "sidebarCount" });
export const newButton = css({
  borderColor: "border.default",
  height: "controlTarget",
  paddingInline: "2.5",
});
export const collections = css({
  alignContent: "start",
  display: "grid",
  minHeight: "0",
  minWidth: "0",
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarGutter: "stable",
  touchAction: "pan-y",
});
export const section = css({
  borderBlockEndWidth: "hairline",
  borderBottomColor: "border.default",
  display: "grid",
  minWidth: "0",
});
export const heading = css({
  alignItems: "center",
  color: "fg.muted",
  display: "flex",
  fontSize: "metadata",
  gap: "2",
  minHeight: "controlTarget",
  minWidth: "0",
  paddingBlock: "1.5",
  paddingInline: "3",
});
export const title = css({
  flexGrow: 1,
  minWidth: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
export const list = css({
  minWidth: "0",
  paddingInline: "2",
});
