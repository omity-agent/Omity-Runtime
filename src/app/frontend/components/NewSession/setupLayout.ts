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
  display: "grid",
  gap: { base: "2", md: "4" },
  gridTemplateColumns: "minmax(0, 1fr)",
  paddingBlock: { base: "3", md: "8" },
});
export const setupSurface = css.raw({
  background: "bg.panel",
  borderRadius: "xl",
  minWidth: "0",
});
export const primaryFields = css(setupSurface, {
  alignItems: "start",
  columnGap: { base: "3", md: "5", lg: "8" },
  display: "grid",
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    lg: "minmax(0, 3fr) minmax(0, 2fr)",
  },
  padding: { base: "3", md: "5" },
  rowGap: "3",
});
export const fieldLabel = css({
  alignItems: "center",
  display: "flex",
  fontWeight: "semibold",
  gap: "2",
});
export const setupControl = css.raw({
  background: "bg.default",
  borderColor: "transparent",
  borderRadius: "md",
});
export const wrappingRow = css.raw({
  alignItems: "start",
  display: "flex",
  flexWrap: "wrap",
});
export const contentSized = css.raw({
  flexBasis: "max-content",
  maxInlineSize: "full",
  minInlineSize: "0",
});
