import { css } from "styled-system/css";

export const chatPage = css({
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr) auto",
  height: "full",
  minHeight: "0",
  minWidth: "0",
  overflow: "hidden",
});
export const emptyChat = css({
  color: "fg.muted",
  display: "grid",
  placeItems: "center",
});
export const conversationLane = css.raw({
  minWidth: "0",
  paddingInlineEnd: { base: "5", xl: "6" },
  paddingInlineStart: { base: "3", md: "4", xl: "6" },
  width: "full",
});
export const stableScrollbar = css.raw({ scrollbarGutter: "stable", scrollbarWidth: "thin" });
