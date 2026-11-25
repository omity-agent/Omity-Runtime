import { GitFork } from "lucide-react";
import { useCallback } from "react";

import type { TimelineMessage } from "../../../../timeline";
import { useTranslation } from "../../../i18n";
import { reportPromiseErrors } from "../../../services/errors";
import { Body } from "../../Transcript/Body";
import { IconButton } from "../../ui";
import { CopyButton } from "./CopyButton";
import { messageRow } from "./messageRow";

export function Message({
  canFork,
  emphasized,
  forkDisabled,
  item,
  latestReasoningIndex,
  latestToolIndex,
  onCancelTool,
  onFork,
  partIndex,
}: {
  canFork: boolean;
  emphasized: boolean;
  forkDisabled: boolean;
  item: TimelineMessage;
  latestReasoningIndex?: number;
  latestToolIndex?: number;
  onCancelTool: (toolCallId: string) => Promise<void>;
  onFork: (messageId: number) => Promise<void>;
  partIndex?: number;
}) {
  const { t } = useTranslation(),
    { role } = item,
    first = partIndex === undefined || partIndex === 0,
    last = partIndex === undefined || partIndex === item.parts.length - 1,
    copyable = role === "user" || role === "system",
    classes = messageRow({ emphasized, pending: role === "user" && item.pending, role }),
    forkLabel = forkDisabled ? t("conversation:pauseBeforeFork") : t("conversation:fork"),
    handleFork = useCallback(() => {
      reportPromiseErrors(onFork(item.id));
    }, [item.id, onFork]);
  return (
    <article className={classes.root}>
      <div className={classes.inner} data-last={last}>
        <div className={classes.content} data-first={first}>
          <Body
            item={item}
            latestReasoningIndex={latestReasoningIndex}
            latestToolIndex={latestToolIndex}
            onCancelTool={onCancelTool}
            partIndex={partIndex}
          />
        </div>
        {first && (canFork || copyable) ? (
          <div className={classes.actions}>
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
            {copyable ? (
              <CopyButton className={classes.action} value={item.copyContent ?? item.content} />
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
