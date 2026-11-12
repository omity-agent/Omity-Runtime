import { GitFork } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import type { TimelineMessage } from "../../../../timeline";
import { reportPromiseErrors } from "../../../services/errors";
import { Body } from "../../Transcript/Body";
import { IconButton } from "../../ui";
import { CopyButton } from "./CopyButton";
import { messageCard } from "./messageCard";

export function Message({
  canFork,
  forkDisabled,
  item,
  latestReasoningIndex,
  latestToolIndex,
  onCancelTool,
  onFork,
  partIndex,
}: {
  canFork: boolean;
  forkDisabled: boolean;
  item: TimelineMessage;
  latestReasoningIndex?: number;
  latestToolIndex?: number;
  onCancelTool: (toolCallId: string) => Promise<void>;
  onFork: (messageId: number) => Promise<void>;
  partIndex?: number;
}) {
  const { t } = useTranslation(),
    role = item.role === "system" ? "user" : item.role,
    first = partIndex === undefined || partIndex === 0,
    last = partIndex === undefined || partIndex === item.parts.length - 1,
    classes = messageCard({ pending: item.role === "user" && item.pending, role }),
    forkLabel = forkDisabled ? t("pauseBeforeFork") : t("fork"),
    handleFork = useCallback(() => {
      reportPromiseErrors(onFork(item.id));
    }, [item.id, onFork]);
  return (
    <div className={classes.root} data-last={last}>
      <article className={classes.body} data-first={first} data-last={last}>
        {first ? (
          <div className={classes.header}>
            <span className={classes.actions}>
              {canFork ? (
                <IconButton
                  aria-label={forkLabel}
                  className={classes.action}
                  disabled={forkDisabled}
                  onClick={handleFork}
                  title={forkLabel}
                  visual="ghost"
                >
                  <GitFork aria-hidden size={14} />
                </IconButton>
              ) : null}
              {role === "user" ? (
                <CopyButton className={classes.action} value={item.copyContent ?? item.content} />
              ) : null}
            </span>
          </div>
        ) : null}
        <Body
          item={item}
          latestReasoningIndex={latestReasoningIndex}
          latestToolIndex={latestToolIndex}
          onCancelTool={onCancelTool}
          partIndex={partIndex}
        />
      </article>
    </div>
  );
}
