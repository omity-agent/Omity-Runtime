import { Switch } from "@ark-ui/react/switch";
import { useCallback, useId } from "react";
import { css, cx } from "styled-system/css";
import { switchRecipe } from "styled-system/recipes";

import { Badge, Field } from "../../ui";
import type { CapabilityOption } from "./preferences";

const classes = switchRecipe({ size: "sm" }),
  group = css({
    background: "bg.default",
    borderColor: "border.default",
    borderRadius: "l2",
    borderWidth: "hairline",
    minWidth: "0",
    padding: "4",
  }),
  legend = css({
    alignItems: "center",
    display: "flex",
    gap: "2",
    paddingInline: "1",
  }),
  stack = css({ display: "grid", gap: "4" }),
  list = css({ display: "grid", gap: "3" }),
  caption = css({ color: "fg.muted", fontSize: "metadata" }),
  row = css({
    alignItems: "start",
    colorPalette: "neutral",
    cursor: "pointer",
    gap: "3",
    minWidth: "0",
    width: "full",
  }),
  details = css({ display: "grid", gap: "1", minWidth: "0", overflowWrap: "anywhere" }),
  description = css({ color: "fg.muted", fontSize: "editor", whiteSpace: "pre-wrap" });
interface CapabilitySection {
  label?: string;
  onChange: (id: string, enable: boolean) => void;
  options: CapabilityOption[];
}
export function CapabilityPanel({
  disabled,
  emptyLabel,
  label,
  sections,
}: {
  disabled: boolean;
  emptyLabel: string;
  label: string;
  sections: CapabilitySection[];
}) {
  const available = sections.filter(({ options }) => options.length > 0),
    options = available.flatMap((section) => section.options);
  return (
    <Field.Group className={group}>
      <Field.Legend className={legend}>
        {label}
        <Badge>
          {options.filter(({ enable }) => enable).length} / {options.length}
        </Badge>
      </Field.Legend>
      {options.length === 0 ? (
        <span className={description}>{emptyLabel}</span>
      ) : (
        <div className={stack}>
          {available.map(({ label: captionText, onChange, options: entries }) => (
            <div
              aria-label={captionText}
              className={list}
              key={captionText ?? label}
              role={captionText ? "group" : undefined}
            >
              {captionText ? <p className={caption}>{captionText}</p> : null}
              {entries.map((option) => (
                <CapabilityToggle
                  disabled={disabled}
                  key={option.id}
                  onChange={onChange}
                  option={option}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Field.Group>
  );
}
function CapabilityToggle({
  option,
  disabled,
  onChange,
}: {
  option: CapabilityOption;
  disabled: boolean;
  onChange: CapabilitySection["onChange"];
}) {
  const descriptionId = useId(),
    handleCheckedChange = useCallback(
      ({ checked }: Switch.CheckedChangeDetails) => onChange(option.id, checked),
      [option.id, onChange],
    );
  return (
    <Switch.Root
      checked={option.enable}
      className={cx(classes.root, row)}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
    >
      <Switch.Control className={classes.control}>
        <Switch.Thumb className={classes.thumb} />
      </Switch.Control>
      <span className={details}>
        <Switch.Label className={classes.label}>{option.name ?? option.id}</Switch.Label>
        {option.description && (
          <span className={description} id={descriptionId}>
            {option.description}
          </span>
        )}
      </span>
      <Switch.HiddenInput
        aria-checked={option.enable}
        aria-describedby={option.description ? descriptionId : undefined}
        role="switch"
      />
    </Switch.Root>
  );
}
