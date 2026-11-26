import { EditorView } from "@codemirror/view";
import { css } from "styled-system/css";
import { token } from "styled-system/tokens";

export const editorFrame = css({
  _disabled: { opacity: 0.65 },
  _focusWithin: { layerStyle: "focusRing", outlineOffset: "focusInset" },
  background: "bg.canvas",
  borderRadius: "md",
  minWidth: "0",
  overflow: "hidden",
});
export const editorTheme = EditorView.theme(
  {
    "&": {
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
      minHeight: token.var("sizes.controlTarget"),
      paddingBlock: token.var("spacing.2"),
      paddingInline: "0",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: token.var("colors.fg.default") },
    ".cm-gutters": {
      backgroundColor: token.var("colors.bg.default"),
      borderInlineEnd: "none",
      color: token.var("colors.fg.muted"),
    },
    ".cm-line": { paddingBlock: "0", paddingInline: token.var("spacing.3") },
    ".cm-placeholder": { color: token.var("colors.fg.muted"), fontStyle: "normal" },
    ".cm-scroller": { cursor: "text", overflow: "visible" },
    ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
      {
        backgroundColor: token.var("colors.bg.selection"),
      },
  },
  { dark: true },
);
