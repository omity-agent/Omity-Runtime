import { type SubmitEvent, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { reportPromiseErrors } from "../../../services/errors";
import { MarkdownEditor } from "../MarkdownEditor";
import { useMessageCandidates } from "../MarkdownEditor/candidateBrowsing";
import { composerDock, composerInput, composerLayout } from "./arrangement";
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
  deleteDisabled = false,
  profileChangeDisabled = false,
  profileChangePending = false,
  sessionStatus,
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
  const { t } = useTranslation("conversation"),
    [submitting, setSubmitting] = useState(false),
    answerState = useQuestionAnswerState(askUser?.callId),
    askNote = answerState.note,
    selectedOptions = answerState.options,
    { attachmentValues, clearAttachments, handlePasteFiles } =
      usePendingAttachments(attachmentSettings),
    submittingRef = useRef(false),
    {
      change,
      content,
      contentRef,
      flush,
      loading,
      revisionRef,
      saverRef,
      setContent,
      target: stableDraftTarget,
    } = useComposerDraft({ draft, draftSaveDelayMs, draftTarget }),
    {
      change: handleContentChange,
      content: input,
      contentRef: inputRef,
      navigate,
      reset,
    } = useMessageCandidates(content, change, userMessages, predictions),
    handleControl = useCallback(
      async (control: Parameters<NonNullable<ComposerProps["onControl"]>>[0]) => {
        if (control !== "force_pause") {
          await flush();
        }
        await onControl?.(control);
      },
      // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Composer opts out of compilation; keep callback identity stable while draft refs change.
      [flush, onControl],
    ),
    handleDelete = useCallback(async () => {
      saverRef.current?.discardPending();
      await onDelete?.();
      // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Composer opts out of compilation; keep callback identity stable while draft refs change.
    }, [onDelete, saverRef]),
    submit = useComposerSubmit({
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
    }),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Composer opts out of compilation; keep the editor's submit callback memoized.
    handleSubmit = useCallback(() => reportPromiseErrors(submit()), [submit]),
    handleFormSubmit = useCallback(
      (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleSubmit();
      },
      [handleSubmit],
    ),
    pasteFiles = useCallback(
      (files: File[]) => handlePasteFiles(files, inputRef.current),
      [handlePasteFiles, inputRef],
    ),
    editorDisabled = disabled || loading || submitting,
    submitDisabled = askUser
      ? editorDisabled ||
        (askUser.kind === "choice" && selectedOptions.length === 0 && askNote.trim().length === 0)
      : editorDisabled || !input.trim();
  return (
    <form className={composerDock} onSubmit={handleFormSubmit}>
      <div className={composerLayout}>
        <div className={composerInput}>
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
        </div>
        <Actions
          availableProfiles={availableProfiles}
          cacheHitWarningRatio={cacheHitWarningRatio}
          controlDisabled={controlDisabled || loading || submitting}
          currentProfile={currentProfile}
          deleteDisabled={deleteDisabled}
          profileChangeDisabled={profileChangeDisabled || loading || submitting}
          profileChangePending={profileChangePending}
          sessionId={stableDraftTarget.kind === "session" ? stableDraftTarget.sessionId : undefined}
          sessionStatus={sessionStatus}
          stepAvailable={stepAvailable}
          submitLabel={askUser ? t("answer") : t("send")}
          submitDisabled={submitDisabled}
          usage={usage}
          onControl={onControl ? handleControl : undefined}
          onDelete={onDelete ? handleDelete : undefined}
          onProfileChange={onProfileChange}
        />
      </div>
    </form>
  );
}
