import { css, cva } from "styled-system/css";

export const container = css({
  maxWidth: "full",
  minWidth: "0",
  position: "relative",
});
export const copyButton = css({
  insetBlockStart: "2",
  insetInlineEnd: "2",
  position: "absolute",
  zIndex: "base",
});
export const block = cva({
  base: {
    background: "var(--inset-surface, {colors.bg.default})",
    borderRadius: "md",
    color: "fg.default",
    display: "block",
    maxWidth: "full",
    minWidth: "0",
    overflowAnchor: "none",
    paddingBlock: "3",
    paddingInlineEnd: "12",
    paddingInlineStart: "3",
    textStyle: "codeBlock",
  },
  defaultVariants: { layout: "contained" },
  variants: {
    layout: {
      contained: { maxHeight: "toolOutput", overflow: "auto", whiteSpace: "pre" },
      flow: {
        maxHeight: "none",
        overflow: "visible",
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
      },
    },
  },
});
export const codeElement = cva({
  base: {
    background: "transparent",
    color: "fg.default",
    display: "block",
    position: "relative",
    textStyle: "codeElement",
    whiteSpace: "inherit",
  },
  defaultVariants: { layout: "contained" },
  variants: {
    layout: {
      contained: { minWidth: "fit" },
      flow: { minWidth: "0" },
    },
  },
});
export const sourceLine = css({
  display: "block",
  minHeight: "sourceLine",
  whiteSpace: "inherit",
});
export const widthSizer = css({
  display: "block",
  height: "0",
  overflow: "hidden",
  visibility: "hidden",
  whiteSpace: "inherit",
});
