import { css } from "styled-system/css";
import { stack } from "styled-system/patterns";

export const region = css({ minWidth: "0", position: "relative", width: "full" });
export const rendered = stack({
  "&[inert]": { visibility: "hidden" },
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
export const source = css({
  background: "transparent",
  borderWidth: "0",
  insetBlock: "0",
  insetInline: "0",
  lineHeight: "markdown",
  maxWidth: "full",
  minWidth: "0",
  overflow: "auto",
  overscrollBehavior: "contain",
  padding: "0",
  position: "absolute",
  textStyle: "sourceCode",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});
export const sourceCode = css({
  font: "inherit",
  overflowWrap: "anywhere",
  whiteSpace: "inherit",
});
