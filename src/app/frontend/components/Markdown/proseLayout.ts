import { css } from "styled-system/css";
import { stack } from "styled-system/patterns";

export const rendered = stack({
  '&[data-source-visible="true"]': { visibility: "hidden" },
  gap: "3",
  lineHeight: "markdown",
  maxWidth: "full",
  minWidth: "0",
  width: "full",
});
export const tableScroll = css({
  maxWidth: "full",
  overflowX: "auto",
  overscrollBehaviorX: "contain",
  width: "full",
});
export const region = css({
  lineHeight: "markdown",
  maxWidth: "full",
  minWidth: "0",
  position: "relative",
  width: "full",
});
export const source = css({
  background: "transparent",
  borderWidth: "0",
  maxWidth: "full",
  minWidth: "0",
  overflow: "visible",
  padding: "0",
  textStyle: "sourceCode",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});
export const sourceCode = css({
  font: "inherit",
  overflowWrap: "anywhere",
  whiteSpace: "inherit",
});
