import type { RefObject } from "react";

import type { PendingAttachment } from "../../../../../attachments/contract";
import { localize } from "../../../../i18n";
import { composerDraftKey, type ComposerDraftTarget } from "../../../../services/composerDrafts";
import type { DraftSaver } from "../../../../services/scheduling/draftSaver";
import { createOptimisticUser } from "../../../../services/transcript/optimistic";
import type { AskUserAnswer, AskUserQuestion } from "../../toolActions";
import type { ComposerProps } from "../props";
import { submitMessage } from "./submit";

export function useComposerSubmit({
  askNote,
  askUser,
  attachmentValues,
  clearAttachments,
  contentRef,
  draftTarget,
  inputRef,
  onAnswer,
  onSend,
  revisionRef,
  reset,
  saverRef,
  selectedOptions,
  setAskNote,
  setContent,
  setSelectedOptions,
  setSubmitting,
  submittingRef,
}: {
  askNote: string;
  askUser?: AskUserQuestion | null;
  attachmentValues: (content: string) => PendingAttachment[];
  clearAttachments: () => void;
  contentRef: RefObject<string | null>;
  draftTarget: ComposerDraftTarget;
  inputRef: RefObject<string>;
  onAnswer?: (callId: string, answer: AskUserAnswer) => Promise<void>;
  onSend: ComposerProps["onSend"];
  revisionRef: RefObject<number | null>;
  reset: (content: string) => void;
  saverRef: RefObject<DraftSaver | undefined>;
  selectedOptions: string[];
  setAskNote: (note: string) => void;
  setContent: (content: string) => void;
  setSelectedOptions: (options: string[]) => void;
  setSubmitting: (submitting: boolean) => void;
  submittingRef: RefObject<boolean | null>;
}) {
  return async () => {
    if (askUser) {
      if (!onAnswer || submittingRef.current) {
        return;
      }
      if (
        askUser.kind === "choice" &&
        selectedOptions.length === 0 &&
        askNote.trim().length === 0
      ) {
        return;
      }
      const answer: AskUserAnswer =
        askUser.kind === "choice"
          ? { kind: "choice", note: askNote, options: selectedOptions }
          : { answer: askNote, kind: "open_ended" };
      submittingRef.current = true;
      setSubmitting(true);
      try {
        await onAnswer(askUser.callId, answer);
        setAskNote("");
        setSelectedOptions([]);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }
    const submittedContent = inputRef.current;
    if (submittingRef.current || !submittedContent.trim()) {
      return;
    }
    const submittedRevision = revisionRef.current ?? 0;
    submittingRef.current = true;
    setSubmitting(true);
    if (draftTarget.kind === "new") {
      throw new Error(localize("frontend:composer.chatProtocolUnsupported"));
    }
    const submissionTarget =
        draftTarget.kind === "session" ? draftTarget.sessionId : composerDraftKey(draftTarget),
      optimistic = createOptimisticUser(submissionTarget, submittedContent),
      sending = onSend(optimistic, submittedRevision, attachmentValues(submittedContent));
    contentRef.current = "";
    reset("");
    setContent("");
    try {
      await submitMessage({
        clearPending: () => saverRef.current?.discardPending(),
        restore: () => {
          revisionRef.current = submittedRevision + 1;
          contentRef.current = submittedContent;
          reset(submittedContent);
          setContent(submittedContent);
          saverRef.current?.schedule(submittedContent, revisionRef.current);
        },
        sending,
      });
      clearAttachments();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
}
