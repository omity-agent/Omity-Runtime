import { Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { SubmitButton } from "../Chat/Composer/controls/SubmitButton";
import { IconButton } from "../ui";
import type { PreparationInput } from "./editor/historyCandidates";
import { MessageEditor } from "./editor/MessageEditor";

interface PairInputs {
  assistant: PreparationInput;
  id: string;
  user: PreparationInput;
}
export function MessageStack({
  disabled,
  latest,
  onAppend,
  onPasteFiles,
  pairs,
  onRemove,
  onSubmit,
  submitDisabled,
  submitting,
}: {
  disabled: boolean;
  latest: PreparationInput;
  onAppend: () => void;
  onPasteFiles: (files: File[]) => string | undefined;
  pairs: PairInputs[];
  onRemove: (id: string) => void;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitting: boolean;
}) {
  const { t } = useTranslation("preparation"),
    editors = pairs.flatMap(({ assistant, id, user }) => [
      <MessageEditor
        disabled={disabled}
        input={user}
        key={user.id}
        onSubmit={onSubmit}
        speaker="user"
      />,
      <MessageEditor
        disabled={disabled}
        input={assistant}
        key={assistant.id}
        onSubmit={onSubmit}
        speaker="assistant"
      >
        <RemovePair disabled={disabled} id={id} onRemove={onRemove} />
      </MessageEditor>,
    ]);
  editors.push(
    <MessageEditor
      disabled={disabled}
      input={latest}
      key={latest.id}
      onPasteFiles={onPasteFiles}
      onSubmit={onSubmit}
      pending
      speaker="user"
    >
      <IconButton
        aria-label={t("addMessagePair")}
        disabled={disabled}
        onClick={onAppend}
        title={t("addMessagePair")}
        type="button"
      >
        <Plus aria-hidden size={16} />
      </IconButton>
      <SubmitButton
        disabled={submitDisabled}
        label={submitting ? t("creating") : t("createAndSend")}
      />
    </MessageEditor>,
  );
  return <div>{editors}</div>;
}
function RemovePair({
  disabled,
  id,
  onRemove,
}: {
  disabled: boolean;
  id: string;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation("preparation"),
    remove = useCallback(() => onRemove(id), [id, onRemove]);
  return (
    <IconButton
      aria-label={t("removeMessagePair")}
      disabled={disabled}
      onClick={remove}
      title={t("removeMessagePair")}
      type="button"
    >
      <Trash2 aria-hidden size={16} />
    </IconButton>
  );
}
