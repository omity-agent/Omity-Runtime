import { defineRecipe } from "@pandacss/dev";

export const button = defineRecipe({
  base: {
    _disabled: { cursor: "not-allowed", opacity: 0.55 },
    _focusVisible: { layerStyle: "focusRing" },
    _motionReduce: { transitionProperty: "none" },
    alignItems: "center",
    appearance: "none",
    borderRadius: "none",
    borderWidth: "hairline",
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    gap: "2",
    justifyContent: "center",
    minHeight: "controlTarget",
    minWidth: "0",
    paddingBlock: "1",
    textAlign: "center",
    textDecoration: "none",
    textStyle: "control",
    touchAction: "manipulation",
    transitionDuration: "fast",
    transitionProperty: "common",
    transitionTimingFunction: "ease",
    userSelect: "none",
    verticalAlign: "middle",
  },
  className: "button",
  defaultVariants: { iconOnly: false, visual: "outline" },
  jsx: ["Button", "IconButton", "LinkButton"],
  variants: {
    iconOnly: {
      false: { paddingInline: "3" },
      true: {
        height: "controlTarget",
        padding: "0",
        width: "controlTarget",
      },
    },
    visual: {
      ghost: {
        _disabled: { color: "fg.disabled" },
        _hover: { background: "bg.emphasized" },
        background: "transparent",
        borderColor: "transparent",
        color: "fg.muted",
      },
      outline: {
        _disabled: {
          background: "bg.default",
          borderColor: "border.default",
          color: "fg.disabled",
        },
        _hover: { background: "bg.emphasized" },
        background: "bg.default",
        borderColor: "border.default",
        color: "fg.default",
      },
      solid: {
        _disabled: {
          background: "bg.default",
          borderColor: "border.default",
          color: "fg.disabled",
        },
        _hover: { background: "fg.muted" },
        background: "fg.default",
        borderColor: "transparent",
        color: "bg.canvas",
      },
    },
  },
});
