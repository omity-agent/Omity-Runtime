import { Collapsible } from "@ark-ui/react/collapsible";
import { ChevronUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { sva } from "styled-system/css";

import { useDisclosure } from "../Transcript/disclosures";

const frame = sva({
  base: {
    accessory: { alignItems: "center", display: "flex", flexShrink: 0 },
    content: {
      _closed: {
        _motionReduce: { animation: "none" },
        animation: "detailCollapse",
      },
      _open: {
        _motionReduce: { animation: "none" },
        animation: "detailExpand",
      },
      overflow: "hidden",
    },
    disclosure: {
      _groupExpanded: { transform: "rotate(180deg)" },
      _motionReduce: { transitionProperty: "none" },
      color: "fg.muted",
      flexShrink: 0,
      height: "smallIcon",
      transitionDuration: "fast",
      transitionProperty: "transform",
      width: "smallIcon",
    },
    header: {
      _hover: { background: "bg.emphasized" },
      alignItems: "center",
      display: "flex",
      height: "detailHeader",
      maxWidth: "full",
      minHeight: "controlTarget",
      paddingInline: "2",
      position: "relative",
      zIndex: "base",
    },
    icon: { flexShrink: 0, height: "smallIcon", width: "smallIcon" },
    root: {
      color: "fg.muted",
      fontSize: "interface",
      maxWidth: "full",
      minWidth: "0",
      padding: "0",
      width: "full",
    },
    title: {
      color: "fg.muted",
      flexBasis: "0",
      flexGrow: 1,
      flexShrink: 1,
      lineHeight: "normal",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    trigger: {
      _focusVisible: { layerStyle: "focusRing", outlineOffset: "focusInset" },
      alignItems: "center",
      appearance: "none",
      background: "transparent",
      borderWidth: "0",
      color: "fg.muted",
      cursor: "pointer",
      display: "flex",
      flexBasis: "0",
      flexGrow: 1,
      flexShrink: 1,
      font: "inherit",
      gap: "2",
      height: "full",
      maxWidth: "full",
      minWidth: "0",
      padding: "0",
      textAlign: "left",
    },
  },
  defaultVariants: { tone: "model" },
  slots: ["root", "header", "trigger", "disclosure", "icon", "title", "accessory", "content"],
  variants: {
    tone: {
      model: {
        icon: { color: "status.model" },
      },
      tool: {
        icon: { color: "status.tool" },
      },
    },
  },
});
export function Frame({
  accessory,
  children,
  expandedInitially,
  icon: Icon,
  label,
  stateKey,
  title,
  tone,
}: {
  accessory?: ReactNode;
  children: ReactNode;
  expandedInitially: boolean;
  icon: LucideIcon;
  label: string;
  stateKey: string;
  title?: ReactNode;
  tone: "model" | "tool";
}) {
  const classes = frame({ tone }),
    { onOpenChange, open, registerDetail } = useDisclosure(stateKey, expandedInitially);
  return (
    <Collapsible.Root
      className={classes.root}
      onOpenChange={onOpenChange}
      open={open}
      ref={registerDetail}
      lazyMount
      unmountOnExit
    >
      <Collapsible.Content className={classes.content}>{children}</Collapsible.Content>
      <div className={classes.header}>
        <Collapsible.Trigger
          aria-label={label}
          className={`group ${classes.trigger}`}
          type="button"
        >
          <ChevronUp aria-hidden className={classes.disclosure} size={12} />
          <Icon className={classes.icon} size={13} />
          {title ? <span className={classes.title}>{title}</span> : null}
        </Collapsible.Trigger>
        {accessory ? <div className={classes.accessory}>{accessory}</div> : null}
      </div>
    </Collapsible.Root>
  );
}
