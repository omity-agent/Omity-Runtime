import { type SubmitEvent, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { reportPromiseErrors } from "../../../services/errors";
import { MarkdownEditor } from "../MarkdownEditor";
import { useMessageCandidates } from "../MarkdownEditor/candidateBrowsing";
import { composerFrame } from "./arrangement";
import { AskUserPrompt } from "./AskUser/Prompt";
import { useQuestionAnswerState } from "./AskUser/state";
import { Actions } from "./controls";
import { usePendingAttachments } from "./hooks/attachments";
import { useComposerDraft } from "./hooks/editing";
import { useComposerSubmit } from "./hooks/submission";
import type { ComposerProps } from "./props";

const emptyPredictions: readonly string[] = [];
export function Composer({
  disabled,
  attachmentSettings,
  availableProfiles,
  cacheHitWarningRatio,
  currentProfile,
  draft,
  draftSaveDelayMs,
  draftTarget,
  userMessages,
  predictions = emptyPredictions,
  controlDisabled = false,
  controlState,
  deleteDisabled = false,
  profileChangeDisabled = false,
  profileChangePending = false,
  stepAvailable = false,
  usage,
  onControl,
  onDelete,
  onAnswer,
  onProfileChange,
  onSend,
  askUser,
}: ComposerProps) {
  "use no memo";
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const answerState = useQuestionAnswerState(askUser?.callId),
    askNote = answerState.note,
    selectedOptions = answerState.options;
  const { attachmentValues, clearAttachments, handlePasteFiles } =
    usePendingAttachments(attachmentSettings);
  const submittingRef = useRef(false);
  const {
    change,
    content,
    contentRef,
    flush,
    loading,
    revisionRef,
    saverRef,
    setContent,
    target: stableDraftTarget,
  } = useComposerDraft({ draft, draftSaveDelayMs, draftTarget });
  const {
    change: handleContentChange,
    content: input,
    contentRef: inputRef,
    navigate,
    reset,
  } = useMessageCandidates(content, change, userMessages, predictions);
  const handleControl = useCallback(
    async (control: Parameters<NonNullable<ComposerProps["onControl"]>>[0]) => {
      await flush();
      await onControl?.(control);
    },
    [flush, onControl],
  );
  const handleDelete = useCallback(async () => {
    saverRef.current?.discardPending();
    await onDelete?.();
  }, [onDelete, saverRef]);
  const submit = useComposerSubmit({
    askNote,
    askUser,
    attachmentValues,
    clearAttachments,
    contentRef,
    draftTarget: stableDraftTarget,
    inputRef,
    onAnswer,
    onSend,
    reset,
    revisionRef,
    saverRef,
    selectedOptions,
    setAskNote: answerState.handleNoteChange,
    setContent,
    setSelectedOptions: answerState.handleOptionsChange,
    setSubmitting,
    submittingRef,
  });
  const handleSubmit = useCallback(() => reportPromiseErrors(submit()), [submit]);
  const handleFormSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleSubmit();
    },
    [handleSubmit],
  );
  const pasteFiles = useCallback(
    (files: File[]) => handlePasteFiles(files, inputRef.current),
    [handlePasteFiles, inputRef],
  );
  const editorDisabled = disabled || loading || submitting,
    submitDisabled = askUser
      ? editorDisabled ||
        (askUser.kind === "choice" && selectedOptions.length === 0 && askNote.trim().length === 0)
      : editorDisabled || !input.trim();
  return (
    <form className={composerFrame} onSubmit={handleFormSubmit}>
      {askUser ? (
        <AskUserPrompt
          note={askNote}
          onNoteChange={answerState.handleNoteChange}
          onOptionsChange={answerState.handleOptionsChange}
          onSubmit={handleSubmit}
          question={askUser}
          selectedOptions={selectedOptions}
        />
      ) : (
        <MarkdownEditor
          disabled={editorDisabled}
          onChange={handleContentChange}
          onNavigate={navigate}
          onPasteFiles={attachmentSettings ? pasteFiles : undefined}
          onSubmit={handleSubmit}
          placeholder={t("messagePlaceholder")}
          value={input}
        />
      )}
      <Actions
        availableProfiles={availableProfiles}
        cacheHitWarningRatio={cacheHitWarningRatio}
        controlDisabled={controlDisabled || loading || submitting}
        controlState={controlState}
        currentProfile={currentProfile}
        deleteDisabled={deleteDisabled}
        profileChangeDisabled={profileChangeDisabled || loading || submitting}
        profileChangePending={profileChangePending}
        sessionId={stableDraftTarget.kind === "session" ? stableDraftTarget.sessionId : undefined}
        stepAvailable={stepAvailable}
        submitLabel={askUser ? t("answer") : t("send")}
        submitDisabled={submitDisabled}
        usage={usage}
        onControl={onControl ? handleControl : undefined}
        onDelete={onDelete ? handleDelete : undefined}
        onProfileChange={onProfileChange}
      />
    </form>
  );
}
