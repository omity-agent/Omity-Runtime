import { defineRecipe, defineSlotRecipe } from "@pandacss/dev";

export const field = defineSlotRecipe({
  base: {
    label: {
      _disabled: { color: "fg.disabled" },
      color: "fg.default",
      fontWeight: "medium",
      textStyle: "control",
    },
    root: { display: "flex", flexDirection: "column", gap: "1.5" },
  },
  className: "field",
  slots: ["root", "label"],
});

export const input = defineRecipe({
  base: {
    _disabled: {
      background: "bg.default",
      borderColor: "border.default",
      color: "fg.disabled",
      cursor: "not-allowed",
    },
    _focusVisible: { layerStyle: "focusRing" },
    _invalid: { borderColor: "status.error" },
    _placeholder: { color: "fg.muted" },
    background: "bg.emphasized",
    borderColor: "border.default",
    borderRadius: "none",
    borderWidth: "hairline",
    color: "fg.default",
    fontSize: "editor",
    minHeight: "controlTarget",
    minWidth: "0",
    paddingBlock: "1",
    paddingInline: "3",
    textStyle: "control",
    width: "full",
  },
  className: "input",
  jsx: ["Input", "Select"],
});
export const badge = defineRecipe({
  base: {
    alignItems: "center",
    background: "bg.emphasized",
    borderRadius: "md",
    color: "fg.muted",
    display: "inline-flex",
    gap: "1",
    paddingBlock: "0.5",
    paddingInline: "1.5",
    textStyle: "badge",
    whiteSpace: "nowrap",
    width: "fit",
  },
  className: "badge",
  jsx: ["Badge"],
});
export const code = defineRecipe({
  base: {
    background: "var(--inset-surface, {colors.bg.default})",
    borderRadius: "sm",
    color: "fg.default",
    display: "inline",
    overflowWrap: "anywhere",
    paddingBlock: "0.5",
    paddingInline: "1.5",
    textStyle: "inlineCode",
    verticalAlign: "baseline",
  },
  className: "code",
  jsx: ["Code"],
});
