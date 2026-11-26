import { type RefObject, type SubmitEvent, useRef, useState } from "react";

import { initialAttachmentTexts, type PendingAttachment } from "../../../../attachments/contract";
import type { InitialSessionState } from "../../../../initialState";
import { reportPromiseErrors } from "../../../services/errors";
import type { PendingAttachments } from "../../Chat/Composer/attachments";

export function useSessionCreation({
  attachmentsRef,
  onCreate,
  optionsReady,
  state,
  workspace,
}: {
  attachmentsRef: RefObject<PendingAttachments>;
  onCreate: (state: InitialSessionState, attachments: PendingAttachment[]) => Promise<void>;
  optionsReady: boolean;
  state: InitialSessionState;
  workspace: string;
}) {
  "use no memo";
  const [submitting, setSubmitting] = useState(false),
    { history, message, model } = state,
    submittingRef = useRef(false),
    complete =
      optionsReady &&
      workspace.trim().length > 0 &&
      message.trim().length > 0 &&
      history.every(({ user, assistant }) => user.trim().length > 0 && assistant.trim().length > 0),
    submit = async () => {
      if (!complete || submittingRef.current) {
        return;
      }
      submittingRef.current = true;
      setSubmitting(true);
      try {
        await onCreate(
          { ...state, model: model?.trim() },
          attachmentsRef.current.values(initialAttachmentTexts(history, message)),
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    handleFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      reportPromiseErrors(submit());
    },
    handleSubmit = () => {
      reportPromiseErrors(submit());
    };
  return { handleFormSubmit, handleSubmit, submitDisabled: submitting || !complete, submitting };
}
