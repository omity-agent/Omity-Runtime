import { sva } from "styled-system/css";
import { grid } from "styled-system/patterns";

export const sessions = grid({ gap: "0.5", paddingBlockEnd: "2" });
export const conversationEntry = sva({
  base: {
    caption: {
      alignItems: "center",
      color: "fg.muted",
      display: "flex",
      gap: "1.5",
      letterSpacing: "caption",
      minWidth: "0",
      overflow: "hidden",
      whiteSpace: "nowrap",
    },
    root: {
      _focusWithin: { background: "bg.emphasized" },
      _hover: { background: "bg.emphasized" },
      _motionReduce: { transitionProperty: "none" },
      borderBlockEndColor: "border.default",
      borderBlockEndWidth: "hairline",
      borderInlineStartColor: "transparent",
      borderInlineStartWidth: "accent",
      minWidth: "0",
      transitionDuration: "fast",
      transitionProperty: "background",
    },
    time: { color: "fg.subtle", fontSize: "metadata", whiteSpace: "nowrap" },
    trigger: {
      _focusVisible: { layerStyle: "focusRing", outlineOffset: "focusInset" },
      alignItems: "center",
      color: "fg.default",
      cursor: "pointer",
      display: "grid",
      gap: "2",
      gridTemplateColumns: "minmax(0, 1fr) auto auto",
      minHeight: "controlTarget",
      paddingBlock: "2",
      paddingInline: "2.5",
      textDecoration: "none",
      textStyle: "control",
      touchAction: "manipulation",
      width: "full",
    },
  },
  defaultVariants: { active: false, unread: false },
  slots: ["root", "trigger", "caption", "time"],
  variants: {
    active: {
      true: {
        caption: { color: "fg.default", textStyle: "selectedCaption" },
        root: { background: "bg.muted", borderInlineStartColor: "fg.default" },
      },
    },
    unread: {
      true: {
        caption: {
          _after: { color: "status.model", content: '"●"', flexShrink: 0, fontSize: "2xs" },
        },
      },
    },
  },
});
