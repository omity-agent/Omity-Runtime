import type { CSSProperties } from "react";
import { css } from "styled-system/css";
import type { CustomContainerComponentProps, CustomItemComponentProps } from "virtua";

import { localize } from "../../../i18n";

const row = css({
  // eslint-disable-next-line @pandacss/no-margin-properties -- This virtual offset represents unmounted rows, not spacing between rendered items.
  "&:first-child": { marginBlockStart: "var(--window-offset)" },
  flexShrink: 0,
});
function flowStyle(style: CSSProperties): CSSProperties {
  return { ...style, display: "flex", flexDirection: "column", pointerEvents: "auto" };
}
function rowStyle(
  style: CSSProperties,
  top: number,
): CSSProperties & { "--window-offset": string } {
  return { ...style, "--window-offset": `${top.toString()}px`, position: "relative" };
}
export function FlowWindow({ children, ref, style }: CustomContainerComponentProps) {
  return (
    <div ref={ref} style={flowStyle(style)}>
      {children}
    </div>
  );
}
export function FlowItem({ children, index, ref, style }: CustomItemComponentProps) {
  const { top, ...geometry } = style;
  if (typeof top !== "number") {
    throw new TypeError(localize("frontend:transcript.virtualOffsetMissing"));
  }
  const placement = rowStyle(geometry, top);
  return (
    <div className={row} data-transcript-index={index} ref={ref} style={placement}>
      {children}
    </div>
  );
}
