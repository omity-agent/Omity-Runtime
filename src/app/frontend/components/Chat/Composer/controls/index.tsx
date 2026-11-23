import { BrushCleaning, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";

import type { Control, SessionStatus } from "../../../../../../types";
import type { TokenUsage } from "../../../../../timeline";
import { useTranslation } from "../../../../i18n";
import { clearTemporaryFiles } from "../../../../services/client";
import { ContextUsage } from "../../ContextUsage";
import { ActionPanel } from "./ActionPanel";
import { ConfirmAction } from "./ConfirmAction";
import { ProfileAction } from "./ProfileAction";
import { RuntimeControl } from "./RuntimeControl";
import { SubmitButton } from "./SubmitButton";

export function Actions({
  availableProfiles,
  cacheHitWarningRatio,
  controlDisabled,
  currentProfile,
  deleteDisabled,
  profileChangeDisabled,
  profileChangePending,
  sessionId,
  sessionStatus,
  submitDisabled,
  submitLabel,
  stepAvailable = false,
  usage,
  onControl,
  onDelete,
  onProfileChange,
}: {
  availableProfiles?: string[];
  cacheHitWarningRatio?: number;
  controlDisabled: boolean;
  currentProfile?: string;
  deleteDisabled: boolean;
  profileChangeDisabled?: boolean;
  profileChangePending?: boolean;
  sessionId?: string;
  sessionStatus?: SessionStatus;
  submitDisabled: boolean;
  submitLabel?: string;
  stepAvailable?: boolean;
  usage?: TokenUsage | null;
  onControl?: (control: Extract<Control, "running" | "step" | "pause">) => Promise<void>;
  onDelete?: () => Promise<void>;
  onProfileChange?: (profile?: string) => void | Promise<void>;
}) {
  const { t } = useTranslation(),
    cleanup = useCallback(async () => {
      if (sessionId) {
        const { skipped } = await clearTemporaryFiles(sessionId);
        if (skipped.length > 0) {
          console.warn(t("conversation:cleanupSkipped", { count: skipped.length }), skipped);
        }
      }
    }, [sessionId, t]),
    footer = useMemo(
      () =>
        usage === undefined ? undefined : (
          <ContextUsage cacheHitWarningRatio={cacheHitWarningRatio} usage={usage} />
        ),
      [cacheHitWarningRatio, usage],
    );
  return (
    <ActionPanel footer={footer}>
      {onDelete ? (
        <ConfirmAction
          confirmation={t("conversation:confirmDelete")}
          disabled={deleteDisabled}
          disabledLabel={t("conversation:pauseBeforeDelete")}
          label={t("conversation:deleteSession")}
          onConfirm={onDelete}
        >
          <Trash2 aria-hidden size={16} />
        </ConfirmAction>
      ) : null}
      {sessionId ? (
        <ConfirmAction
          confirmation={t("conversation:confirmCleanup")}
          label={t("conversation:clearTemporaryFiles")}
          onConfirm={cleanup}
        >
          <BrushCleaning aria-hidden size={16} />
        </ConfirmAction>
      ) : null}
      {onControl ? (
        <RuntimeControl
          controlDisabled={controlDisabled}
          onControl={onControl}
          sessionStatus={sessionStatus}
          stepAvailable={stepAvailable}
        />
      ) : null}
      {availableProfiles && onProfileChange ? (
        <ProfileAction
          availableProfiles={availableProfiles}
          currentProfile={currentProfile}
          disabled={profileChangeDisabled ?? false}
          pending={profileChangePending ?? false}
          onChange={onProfileChange}
        />
      ) : null}
      <SubmitButton disabled={submitDisabled} label={submitLabel ?? t("conversation:send")} />
    </ActionPanel>
  );
}
