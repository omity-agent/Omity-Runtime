import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MarkdownEditor } from "../MarkdownEditor";
import { composerFrame } from "./arrangement";
import { AskUserPrompt } from "./AskUser/Prompt";
import { useQuestionAnswerState } from "./AskUser/state";
import { Actions } from "./controls";
import { UserMessageHistory } from "./history";
import { usePendingAttachments } from "./hooks/attachments";
import { useComposerDraft } from "./hooks/editing";
import { useComposerEvents } from "./hooks/events";
import { useComposerSubmit } from "./hooks/submission";
import { useSuggestionNavigation } from "./hooks/suggestionNavigation";
import { UserInputPrediction } from "./prediction";
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
  const { t } = useTranslation(),
    [submitting, setSubmitting] = useState(false),
    answerState = useQuestionAnswerState(askUser?.callId),
    askNote = answerState.note,
    selectedOptions = answerState.options,
    { attachmentValues, clearAttachments, handlePasteFiles } =
      usePendingAttachments(attachmentSettings),
    historyRef = useRef(new UserMessageHistory()),
    predictionRef = useRef(new UserInputPrediction()),
    submittingRef = useRef(false),
    {
      content,
      contentRef,
      flush,
      loading,
      revisionRef,
      saverRef,
      setContent,
      target: stableDraftTarget,
    } = useComposerDraft({ draft, draftSaveDelayMs, draftTarget, historyRef, predictionRef }),
    handleControl = useCallback(
      async (control: Parameters<NonNullable<ComposerProps["onControl"]>>[0]) => {
        await flush();
        await onControl?.(control);
      },
      [flush, onControl],
    ),
    handleDelete = useCallback(async () => {
      saverRef.current?.discardPending();
      await onDelete?.();
    }, [onDelete, saverRef]),
    submit = useComposerSubmit({
      askNote,
      askUser,
      attachmentValues,
      clearAttachments,
      contentRef,
      draftTarget: stableDraftTarget,
      historyRef,
      onAnswer,
      onSend,
      revisionRef,
      saverRef,
      selectedOptions,
      setAskNote: answerState.handleNoteChange,
      setContent,
      setSelectedOptions: answerState.handleOptionsChange,
      setSubmitting,
      submittingRef,
    }),
    { handleContentChange, handleFormSubmit, handleSubmit, pasteFiles, updateContent } =
      useComposerEvents({
        contentRef,
        handlePasteFiles,
        historyRef,
        predictionRef,
        revisionRef,
        saverRef,
        setContent,
        submit,
      }),
    { handleHistoryNavigate, handlePredictionNavigate } = useSuggestionNavigation({
      contentRef,
      historyRef,
      predictionRef,
      predictions,
      updateContent,
      userMessages,
    }),
    editorDisabled = disabled || loading || submitting,
    submitDisabled = askUser
      ? editorDisabled ||
        (askUser.kind === "choice" && selectedOptions.length === 0 && askNote.trim().length === 0)
      : editorDisabled || !content.trim();
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
          onHistoryNavigate={handleHistoryNavigate}
          onPredictionNavigate={handlePredictionNavigate}
          onPasteFiles={attachmentSettings ? pasteFiles : undefined}
          onSubmit={handleSubmit}
          placeholder={t("messagePlaceholder")}
          value={content}
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
