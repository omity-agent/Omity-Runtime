import { type ComponentProps, createElement } from "react";
import { cx } from "styled-system/css";
import { badge, code } from "styled-system/recipes";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return createElement("span", { ...props, className: cx(badge(), className) });
}

export function Code({ className, ...props }: ComponentProps<"code">) {
  return createElement("code", { ...props, className: cx(code(), className) });
}
