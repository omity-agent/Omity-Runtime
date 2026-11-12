import { type ComponentProps, createElement } from "react";
import { cx } from "styled-system/css";
import { button, type ButtonVariantProps } from "styled-system/recipes";

type ButtonProps = ComponentProps<"button"> & ButtonVariantProps;
type LinkButtonProps = ComponentProps<"a"> & ButtonVariantProps;

export function Button({ className, ...props }: ButtonProps) {
  const [variants, elementProps] = button.splitVariantProps(props);
  return createElement("button", {
    type: "button",
    ...elementProps,
    className: cx(button(variants), className),
  });
}

export function LinkButton({ className, ...props }: LinkButtonProps) {
  const [variants, elementProps] = button.splitVariantProps(props);
  return createElement("a", { ...elementProps, className: cx(button(variants), className) });
}

export function IconButton(props: ButtonProps) {
  return createElement(Button, { ...props, iconOnly: true });
}
