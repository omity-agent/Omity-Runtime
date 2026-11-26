import { css } from "styled-system/css";

import { conversationLane, stableScrollbar } from "../Chat/layout";

export const scroll = css(stableScrollbar, {
  minHeight: "0",
  overflowY: "auto",
  overscrollBehavior: "contain",
});
export const scrollContent = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: "full",
});
export const setup = css(conversationLane, {
  alignContent: "start",
  alignItems: "start",
  alignSelf: "center",
  display: "grid",
  gap: { base: "4", md: "6" },
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    xl: "minmax(0, 1fr) minmax(0, 1.6fr)",
  },
  maxWidth: "breakpoint-xl",
  paddingBlock: { base: "4", md: "6" },
});
export const configuration = css({
  alignContent: "start",
  display: "grid",
  gap: "4",
  gridTemplateColumns: { base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
  minWidth: "0",
});
export const configurationRow = css({ gridColumn: { sm: "1 / -1" } });
