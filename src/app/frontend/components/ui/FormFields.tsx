import { Field as ArkField } from "@ark-ui/react/field";
import { type ComponentProps, createElement } from "react";
import { cx } from "styled-system/css";
import { field, input } from "styled-system/recipes";

const classes = field();
type InputProps = ComponentProps<typeof ArkField.Input> & { name: string };
type SelectProps = ComponentProps<typeof ArkField.Select> & { name: string };

export function Input({ className, ...props }: InputProps) {
  return createElement(ArkField.Input, { ...props, className: cx(input(), className) });
}

export function Select({ className, ...props }: SelectProps) {
  return createElement(ArkField.Select, { ...props, className: cx(input(), className) });
}

function FieldRoot({ className, ...props }: ComponentProps<typeof ArkField.Root>) {
  return createElement(ArkField.Root, { ...props, className: cx(classes.root, className) });
}

function FieldLabel({ className, ...props }: ComponentProps<typeof ArkField.Label>) {
  return createElement(ArkField.Label, { ...props, className: cx(classes.label, className) });
}

function FieldGroup({ className, ...props }: ComponentProps<"fieldset">) {
  return createElement("fieldset", { ...props, className: cx(classes.root, className) });
}

function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
  return createElement("legend", { ...props, className: cx(classes.label, className) });
}

export const Field = {
  Group: FieldGroup,
  Label: FieldLabel,
  Legend: FieldLegend,
  Root: FieldRoot,
};
