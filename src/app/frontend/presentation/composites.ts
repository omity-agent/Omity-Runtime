import { defineAnimationStyles, defineGlobalStyles, defineLayerStyles } from "@pandacss/dev";

export const animationStyles = defineAnimationStyles({
  activity: {
    value: { _motionReduce: { animation: "disabled" }, animation: "progressPulse" },
  },
  busy: {
    value: { _motionReduce: { animation: "disabled" }, animation: "spin" },
  },
});

export const layerStyles = defineLayerStyles({
  focusRing: {
    value: {
      outlineColor: "border.outline",
      outlineOffset: "0.5",
      outlineStyle: "solid",
      outlineWidth: "hairline",
    },
  },
  reasoningText: {
    value: {
      "--colors-fg-default": "currentColor",
      "--colors-fg-link": "currentColor",
      "--colors-fg-muted": "currentColor",
      "--colors-syntax-addition":
        "color-mix(in srgb, {colors.accent.green} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-comment":
        "color-mix(in srgb, {colors.accent.indigo} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-deletion":
        "color-mix(in srgb, {colors.accent.red} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-keyword":
        "color-mix(in srgb, {colors.accent.purple} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-meta":
        "color-mix(in srgb, {colors.accent.blue} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-number":
        "color-mix(in srgb, {colors.accent.orange} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-property":
        "color-mix(in srgb, {colors.accent.blue} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-string":
        "color-mix(in srgb, {colors.accent.green} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--colors-syntax-title":
        "color-mix(in srgb, {colors.accent.cyan} var(--reasoning-syntax-strength), {colors.bg.canvas})",
      "--reasoning-syntax-strength": "65%",
    },
  },
});
export const globalCss = defineGlobalStyles({
  "*": { boxSizing: "border-box" },
  ".lucide": { flexShrink: 0, height: "interfaceIcon", width: "interfaceIcon" },
  body: {
    background: "bg.canvas",
    color: "fg.default",
    colorScheme: "dark",
    fontFamily: "body",
    overflow: "hidden",
  },
  html: { fontSize: { _largeCanvas: "125%", base: "100%" } },
  "html, body, #root": { margin: "0", minHeight: "100%" },
});
