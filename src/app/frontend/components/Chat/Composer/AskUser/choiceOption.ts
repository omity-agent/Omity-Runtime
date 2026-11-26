import { sva } from "styled-system/css";

export const choiceOption = sva({
  base: {
    control: {
      _checked: { background: "bg.emphasized", borderColor: "fg.default" },
      alignItems: "center",
      borderColor: "border.default",
      borderWidth: "hairline",
      color: "fg.default",
      display: "inline-flex",
      flexShrink: 0,
      height: "5",
      justifyContent: "center",
      width: "5",
    },
    indicator: { display: "inline-flex" },
    label: { color: "fg.muted", fontSize: "editor", overflowWrap: "anywhere" },
    root: {
      _disabled: { cursor: "not-allowed", opacity: 0.55 },
      _focusWithin: { layerStyle: "focusRing", outlineOffset: "focusInset" },
      _hover: { background: "bg.emphasized" },
      alignItems: "center",
      cursor: "pointer",
      display: "flex",
      gap: "2",
      minHeight: "controlTarget",
      minWidth: "0",
      padding: "2",
    },
  },
  defaultVariants: { kind: "checkbox" },
  slots: ["root", "control", "indicator", "label"],
  variants: {
    kind: {
      checkbox: { control: { borderRadius: "none" } },
      radio: {
        control: {
          _before: {
            background: "fg.default",
            borderRadius: "full",
            content: '""',
            height: "2.5",
            opacity: 0,
            width: "2.5",
          },
          _checked: { _before: { opacity: 1 } },
          borderRadius: "full",
        },
      },
    },
  },
});
