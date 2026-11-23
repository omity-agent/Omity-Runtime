import { css } from "styled-system/css";

export const toolbar = css({
  "&:empty": { display: "none" },
  alignItems: "center",
  background: "bg.panel",
  borderBlockEndWidth: "hairline",
  borderBottomColor: "border.default",
  display: "flex",
  flexShrink: 0,
  gap: "1",
  padding: "2",
});
export const total = css({ color: "fg.subtle", textStyle: "sidebarCount" });
export const collections = css({
  alignContent: "start",
  display: "grid",
  flexGrow: 1,
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
