import { css } from "styled-system/css";

export const scroll = css({
  minHeight: "0",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarGutter: "stable",
});
export const scrollContent = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  minHeight: "full",
});
export const setup = css({
  alignContent: "start",
  alignItems: "start",
  alignSelf: "center",
  display: "grid",
  gap: { base: "4", md: "6" },
  gridTemplateColumns: {
    base: "minmax(0, 1fr)",
    xl: "minmax(0, 1fr) minmax(0, 1.6fr)",
  },
  justifySelf: "center",
  maxWidth: "breakpoint-xl",
  padding: { _short: "4", base: "4", md: "8" },
  width: "full",
});
export const configuration = css({
  alignContent: "start",
  display: "grid",
  gap: "4",
  gridTemplateColumns: { base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
  minWidth: "0",
});
export const setupFirst = css({ gridColumn: { sm: "1 / -1" } });
