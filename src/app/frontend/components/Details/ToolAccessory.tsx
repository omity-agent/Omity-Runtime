import { CircleStop, LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { css } from "styled-system/css";

import type { ToolCallPhase } from "../../../timeline";
import { useTranslation } from "../../i18n";
import { reportPromiseErrors } from "../../services/errors";
import { Badge, IconButton } from "../ui";

const accessory = css({ alignItems: "center", display: "flex", gap: "2" }),
  stopButton = css({
    borderWidth: "0",
    color: "status.tool",
    height: "6",
    minWidth: "6",
    padding: "0",
  });
export function useToolAccessory({
  callId,
  cancellable,
  onCancel,
  phase,
}: {
  callId: string;
  cancellable: boolean;
  onCancel: (toolCallId: string) => Promise<void>;
  phase: ToolCallPhase;
}) {
  const { t } = useTranslation(),
    [cancelling, setCancelling] = useState(false),
    handleCancel = useCallback(() => {
      setCancelling(true);
      reportPromiseErrors(cancelTool(callId, onCancel, setCancelling));
    }, [callId, onCancel, setCancelling]);
  return phase === "streaming" || cancellable ? (
    <span className={accessory}>
      {phase === "streaming" ? <Badge>{t("conversation:streaming")}</Badge> : null}
      {cancellable ? (
        <IconButton
          aria-label={t("conversation:stopTool")}
          className={stopButton}
          disabled={cancelling}
          onClick={handleCancel}
          title={t("conversation:stopTool")}
          type="button"
          visual="ghost"
        >
          {cancelling ? (
            <LoaderCircle aria-hidden size={14} />
          ) : (
            <CircleStop aria-hidden size={14} />
          )}
        </IconButton>
      ) : null}
    </span>
  ) : undefined;
}
async function cancelTool(
  callId: string,
  onCancel: (toolCallId: string) => Promise<void>,
  setCancelling: (cancelling: boolean) => void,
) {
  try {
    await onCancel(callId);
  } catch (error: unknown) {
    setCancelling(false);
    throw error;
  }
}
