import { EditorView } from "@codemirror/view";
import { cva } from "styled-system/css";
import { token } from "styled-system/tokens";

export const editorFrame = cva({
  base: {
    _focusWithin: { layerStyle: "focusRing" },
    background: "bg.subtle",
    borderColor: "border.emphasized",
    borderWidth: "hairline",
    minWidth: "0",
    overflow: "hidden",
  },
  defaultVariants: { disabled: false, mode: "fixed", visual: "outline" },
  variants: {
    disabled: { true: { borderColor: "border.default", opacity: 0.65 } },
    mode: {
      fill: { alignSelf: "stretch", height: "full", minHeight: "0" },
      fixed: {
        height: "composerEditor",
        maxHeight: { _short: "editorShort", smDown: "editorCompact" },
      },
      fluid: { alignSelf: "start" },
    },
    visual: {
      bare: { _focusWithin: { outlineOffset: "focusInset" }, borderWidth: "0" },
      outline: {},
    },
  },
});
export const editorWrapper = cva({
  base: { cursor: "text" },
  defaultVariants: { fill: true },
  variants: { fill: { true: { height: "full" } } },
});
export const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: token.var("colors.bg.default"),
      color: token.var("colors.fg.default"),
      fontFamily: token.var("fonts.mono"),
      fontSize: token.var("fontSizes.editor"),
    },
    ".cm-activeLine": {
      backgroundColor: `color-mix(in srgb, ${token.var("colors.bg.emphasized")} 20%, transparent)`,
    },
    ".cm-activeLineGutter": { backgroundColor: token.var("colors.bg.emphasized") },
    ".cm-content": {
      caretColor: token.var("colors.fg.default"),
      lineHeight: token.var("lineHeights.editor"),
      paddingBlock: token.var("spacing.2.5"),
      paddingInline: "0",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: token.var("colors.fg.default") },
    ".cm-gutters": {
      backgroundColor: token.var("colors.bg.emphasized"),
      borderInlineEnd: `${token.var("borderWidths.hairline")} solid ${token.var("colors.border.default")}`,
      color: token.var("colors.fg.subtle"),
    },
    ".cm-line": { paddingBlock: "0", paddingInline: token.var("spacing.3") },
    ".cm-placeholder": { color: token.var("colors.fg.subtle"), fontStyle: "normal" },
    ".cm-scroller": { cursor: "text", overflow: "auto" },
    ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
      {
        backgroundColor: token.var("colors.bg.selection"),
      },
  },
  { dark: true },
);
export const fluidTheme = EditorView.theme({
  "&": { height: "auto" },
  ".cm-content": { minHeight: token.var("sizes.11") },
  ".cm-gutters": { color: token.var("colors.fg.muted") },
  ".cm-placeholder": { color: token.var("colors.fg.muted") },
  ".cm-scroller": { overflow: "visible" },
});
export const fixedTheme = EditorView.theme({
  "&": { height: "100%" },
  ".cm-content": { minHeight: "100%" },
});
