import { Plus, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { composerFrame, composerRole } from "../../Chat/Composer/arrangement";
import { ActionPanel } from "../../Chat/Composer/controls/ActionPanel";
import { SubmitButton } from "../../Chat/Composer/controls/SubmitButton";
import { MarkdownEditor } from "../../Chat/MarkdownEditor";
import type { InputDirection } from "../../Chat/MarkdownEditor/candidateBrowsing";
import { IconButton } from "../../ui";

export function LatestMessage({
  disabled,
  message,
  submitDisabled,
  submitting,
  onAddPair,
  onChange,
  onNavigate,
  onPasteFiles,
  onSubmit,
}: {
  disabled: boolean;
  message: string;
  submitDisabled: boolean;
  submitting: boolean;
  onAddPair: () => void;
  onChange: (content: string) => void;
  onNavigate: (direction: InputDirection) => string | undefined;
  onPasteFiles?: (files: File[]) => string | undefined;
  onSubmit: () => void;
}) {
  const { t } = useTranslation(),
    footer = useMemo(
      () => (
        <span aria-label={t("user")} className={composerRole} title={t("user")}>
          <UserRound aria-hidden size={20} />
        </span>
      ),
      [t],
    );
  return (
    <div className={composerFrame}>
      <MarkdownEditor
        disabled={disabled}
        label={t("user")}
        onChange={onChange}
        onNavigate={onNavigate}
        onPasteFiles={onPasteFiles}
        onSubmit={onSubmit}
        placeholder={t("messagePlaceholder")}
        value={message}
      />
      <ActionPanel footer={footer}>
        <IconButton
          aria-label={t("addMessagePair")}
          disabled={disabled}
          onClick={onAddPair}
          title={t("addMessagePair")}
          type="button"
        >
          <Plus aria-hidden size={16} />
        </IconButton>
        <SubmitButton
          disabled={submitDisabled}
          label={submitting ? t("creating") : t("createAndSend")}
        />
      </ActionPanel>
    </div>
  );
}
