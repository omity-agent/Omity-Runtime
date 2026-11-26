import { Switch } from "@ark-ui/react/switch";
import { useCallback, useId } from "react";
import { sva } from "styled-system/css";

import { contentSized } from "../setupLayout";
import type { CapabilityOption } from "./preferences";

const toggle = sva({
    base: {
      control: {
        _checked: { background: "fg.default" },
        alignItems: "center",
        background: "bg.emphasized",
        borderRadius: "full",
        display: "inline-flex",
        flexShrink: 0,
        padding: "0.5",
        width: "7",
      },
      description: {
        color: "fg.muted",
        fontSize: "metadata",
        inlineSize: "max",
        maxInlineSize: "full",
        overflowWrap: "anywhere",
        whiteSpace: "pre-wrap",
      },
      label: { fontSize: "interface", inlineSize: "max", minInlineSize: "0" },
      line: { alignItems: "center", display: "flex", gap: "2" },
      root: {
        ...contentSized,
        "&:has(:focus-visible)": { layerStyle: "focusRing", outlineOffset: "focusInset" },
        _disabled: { cursor: "not-allowed", opacity: 0.55 },
        _hover: { background: "bg.default" },
        borderRadius: "md",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        minHeight: "8",
        overflowWrap: "anywhere",
        paddingBlock: "1",
        paddingInline: "1",
        position: "relative",
      },
      thumb: {
        _checked: { background: "bg.canvas", transform: "translateX(100%)" },
        _motionReduce: { transitionProperty: "none" },
        background: "fg.disabled",
        borderRadius: "full",
        height: "3",
        transitionDuration: "fast",
        transitionProperty: "transform",
        width: "3",
      },
    },
    slots: ["root", "line", "control", "description", "label", "thumb"],
  }),
  classes = toggle();

export function ToggleRow({
  description,
  option,
  disabled,
  onChange,
}: {
  description?: string;
  option: CapabilityOption;
  disabled: boolean;
  onChange: (id: string, enable: boolean) => void;
}) {
  const descriptionId = useId(),
    handleCheckedChange = useCallback(
      ({ checked }: Switch.CheckedChangeDetails) => onChange(option.id, checked),
      [option.id, onChange],
    );
  return (
    <Switch.Root
      checked={option.enable}
      className={classes.root}
      disabled={disabled}
      onCheckedChange={handleCheckedChange}
    >
      <span className={classes.line}>
        <Switch.Control className={classes.control}>
          <Switch.Thumb className={classes.thumb} />
        </Switch.Control>
        <Switch.Label className={classes.label}>{option.name ?? option.id}</Switch.Label>
      </span>
      {description && (
        <span className={classes.description} id={descriptionId}>
          {description}
        </span>
      )}
      <Switch.HiddenInput
        aria-checked={option.enable}
        aria-describedby={description ? descriptionId : undefined}
        role="switch"
      />
    </Switch.Root>
  );
}
