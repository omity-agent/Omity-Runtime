import { Bot, UserRound } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { css } from "styled-system/css";

import { useTranslation } from "../../../i18n";
import { composerInput, composerLayout, draftDock } from "../../Chat/Composer/arrangement";
import { ActionPanel } from "../../Chat/Composer/controls/ActionPanel";
import { MarkdownEditor } from "../../Chat/MarkdownEditor";
import type { PreparationInput } from "./historyCandidates";

const roleIcon = css({
  alignItems: "center",
  color: "fg.muted",
  display: { base: "none", md: "flex" },
});

export function MessageEditor({
  children,
  disabled,
  input,
  pending,
  speaker,
  onPasteFiles,
  onSubmit,
}: {
  children?: ReactNode;
  disabled: boolean;
  input: PreparationInput;
  pending?: boolean;
  speaker: "assistant" | "user";
  onPasteFiles?: (files: File[]) => string | undefined;
  onSubmit: () => void;
}) {
  const { t } = useTranslation(),
    label = t(speaker === "user" ? "conversation:user" : "conversation:assistant"),
    RoleIcon = speaker === "user" ? UserRound : Bot,
    footer = useMemo(
      () => (
        <span aria-label={label} className={roleIcon} title={label}>
          <RoleIcon aria-hidden size={20} />
        </span>
      ),
      [label, RoleIcon],
    );
  return (
    <div className={draftDock}>
      <div className={composerLayout}>
        <div className={composerInput}>
          <MarkdownEditor
            disabled={disabled}
            label={label}
            onChange={input.handleChange}
            onNavigate={input.handleNavigate}
            onPasteFiles={onPasteFiles}
            onSubmit={onSubmit}
            placeholder={pending ? t("conversation:messagePlaceholder") : ""}
            value={input.content}
          />
        </div>
        <ActionPanel footer={footer}>{children}</ActionPanel>
      </div>
    </div>
  );
}
