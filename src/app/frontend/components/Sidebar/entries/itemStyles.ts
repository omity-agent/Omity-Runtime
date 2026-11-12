import { css } from "styled-system/css";

export const sessions = css({ display: "grid", gap: "0.5", paddingBlockEnd: "2" });
export const item = css({
  _focusWithin: { background: "control" },
  _hover: { background: "control" },
  alignItems: "stretch",
  borderBlockEndWidth: "hairline",
  borderBottomColor: "line",
  borderInlineStartWidth: "accent",
  borderLeftColor: "clear",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  minWidth: "zero",
  overflow: "hidden",
  transition: "[background 120ms ease]",
});
export const selected = css({
  _focusWithin: { background: "clear" },
  _hover: { background: "clear" },
  background: "clear",
  borderLeftColor: "text",
});
export const row = css({
  _focusVisible: {
    background: "clear",
    outline: "none",
  },
  _hover: { background: "clear" },
  background: "clear",
  borderWidth: "zero",
  display: "grid",
  fontSize: "interface",
  gap: "2",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  height: "auto",
  justifyContent: "stretch",
  minHeight: "controlTarget",
  paddingBlock: "2",
  paddingInline: "2.5",
  textAlign: "left",
  width: "full",
});
export const caption = css({
  alignItems: "center",
  color: "mutedStrong",
  display: "flex",
  letterSpacing: "caption",
  minWidth: "zero",
  overflow: "hidden",
  whiteSpace: "nowrap",
});
export const selectedCaption = css({
  color: "text",
  textStyle: "selectedCaption",
});
export const unreadCaption = css({
  _after: {
    color: "statusModel",
    content: '"●"',
    flexShrink: 0,
    fontSize: "2xs",
    marginInlineStart: "1.5",
  },
});
export const time = css({
  color: "muted",
  fontSize: "metadata",
  whiteSpace: "nowrap",
});
