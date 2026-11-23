import {
  Bot,
  Circle,
  CircleAlert,
  Hourglass,
  LoaderCircle,
  type LucideIcon,
  Pause,
  StepForward,
  Wrench,
} from "lucide-react";
import { css, cva, cx } from "styled-system/css";

import type { ErrorDetails } from "../../../../../failures/details";
import type { SessionStatus } from "../../../../../types";
import { useTranslation } from "../../../i18n";
import { statusLabelKey } from "../sessions";

const indicator = cva({
    base: {
      alignItems: "center",
      display: "inline-flex",
      flexShrink: 0,
      fontSize: "metadata",
      gap: "1.5",
    },
    defaultVariants: { status: "idle" },
    variants: {
      status: {
        error: { color: "status.error" },
        idle: { color: "status.idle" },
        paused: { color: "status.paused" },
        pausing: { color: "status.paused" },
        stepping: { color: "status.model" },
        streaming: { color: "status.model" },
        tool: { color: "status.tool" },
        waiting: { color: "status.model" },
      },
    },
  }),
  icon = css({ height: "smallIcon", width: "smallIcon" }),
  activeIcon = css({ animationStyle: "activity" }),
  statusMeta: Record<SessionStatus, { icon: LucideIcon; active?: boolean }> = {
    error: { icon: CircleAlert },
    idle: { icon: Circle },
    paused: { icon: Pause },
    pausing: { active: true, icon: LoaderCircle },
    stepping: { active: true, icon: StepForward },
    streaming: { active: true, icon: Bot },
    tool: { active: true, icon: Wrench },
    waiting: { active: true, icon: Hourglass },
  };
export function Status({
  compact = false,
  error,
  status,
}: {
  compact?: boolean;
  error: ErrorDetails | null;
  status: SessionStatus;
}) {
  const { t } = useTranslation(),
    meta = statusMeta[status],
    Icon = meta.icon,
    label = t(statusLabelKey(status)),
    description = status === "error" && error ? `${label}: ${error.message}` : label;
  return (
    <span
      aria-label={description}
      className={indicator({ status })}
      title={status === "error" && error ? error.message : label}
    >
      <Icon
        aria-hidden="true"
        className={cx(icon, meta.active && activeIcon)}
        size={12}
        strokeWidth={2}
      />
      {!compact && <span>{label}</span>}
    </span>
  );
}
