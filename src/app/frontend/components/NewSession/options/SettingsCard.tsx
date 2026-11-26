import type { LucideIcon } from "lucide-react";
import { useId, useMemo } from "react";
import { css } from "styled-system/css";

import { Badge } from "../../ui";
import { contentSized, setupSurface, wrappingRow } from "../setupLayout";
import type { CapabilityOption } from "./preferences";
import { ToggleRow } from "./ToggleRow";

const panel = css(setupSurface, contentSized, {
    alignContent: "start",
    display: "grid",
    gap: { base: "1", md: "2" },
    gridTemplateColumns: "minmax(0, 1fr)",
    padding: { base: "2", md: "4", sm: "3" },
  }),
  heading = css({
    alignItems: "center",
    display: "flex",
    gap: "2",
    justifyContent: "space-between",
  }),
  title = css({
    alignItems: "center",
    display: "flex",
    fontWeight: "semibold",
    gap: "2",
    overflowWrap: "anywhere",
    textStyle: "control",
  }),
  glyph = css({
    background: "bg.default",
    borderRadius: "md",
    color: "fg.muted",
    display: "grid",
    flexShrink: 0,
    height: "6",
    placeItems: "center",
    width: "6",
  }),
  count = css({ background: "bg.default", flexShrink: 0, fontVariantNumeric: "tabular-nums" }),
  narrowTrack = css.raw(wrappingRow, {
    inlineSize: "min",
    maxInlineSize: "full",
    minInlineSize: "full",
  }),
  groups = css(narrowTrack, { gap: { base: "1", md: "2" } }),
  subgroup = css(contentSized),
  entries = css(narrowTrack, { columnGap: "2" }),
  caption = css({
    color: "fg.muted",
    fontSize: "metadata",
    inlineSize: "max",
    maxInlineSize: "full",
    overflowWrap: "anywhere",
    paddingInline: "1",
  });
interface CapabilitySection {
  hideDescriptions?: boolean;
  label?: string;
  onChange: (id: string, enable: boolean) => void;
  options: CapabilityOption[];
}
export function SettingsCard({
  disabled,
  emptyLabel,
  icon: Icon,
  label,
  sections,
}: {
  disabled: boolean;
  emptyLabel: string;
  icon: LucideIcon;
  label: string;
  sections: CapabilitySection[];
}) {
  const titleId = useId(),
    available = sections.filter(({ options }) => options.length > 0),
    options = available.flatMap((section) => section.options),
    total = options.length,
    span = useOptionWeight(total);
  return (
    <section aria-labelledby={titleId} className={panel} style={span}>
      <header className={heading}>
        <h2 className={title} id={titleId}>
          <span className={glyph}>
            <Icon aria-hidden />
          </span>
          {label}
        </h2>
        <Badge className={count}>
          {options.filter(({ enable }) => enable).length} / {total}
        </Badge>
      </header>
      {total === 0 ? (
        <p className={caption}>{emptyLabel}</p>
      ) : (
        <div className={groups}>
          {available.map((section) => (
            <OptionGroup disabled={disabled} key={section.label ?? label} section={section} />
          ))}
        </div>
      )}
    </section>
  );
}

function OptionGroup({
  disabled,
  section: { hideDescriptions, label, onChange, options },
}: {
  disabled: boolean;
  section: CapabilitySection;
}) {
  const span = useOptionWeight(options.length);
  return (
    <div aria-label={label} className={subgroup} role={label ? "group" : undefined} style={span}>
      {label ? <p className={caption}>{label}</p> : null}
      <div className={entries}>
        {options.map((option) => (
          <ToggleRow
            description={hideDescriptions ? undefined : option.description}
            disabled={disabled}
            key={option.id}
            onChange={onChange}
            option={option}
          />
        ))}
      </div>
    </div>
  );
}

function useOptionWeight(total: number) {
  return useMemo(() => ({ flexGrow: Math.max(1, total) }), [total]);
}
