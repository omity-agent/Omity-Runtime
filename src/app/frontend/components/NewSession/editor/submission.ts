import { type RefObject, type SubmitEvent, useRef, useState } from "react";

import type { PendingAttachment } from "../../../../attachments/contract";
import type { EditablePair } from "../../../../composition/preparation";
import type { InitialSessionState } from "../../../../initialState";
import { reportPromiseErrors } from "../../../services/errors";
import type { PendingAttachments } from "../../Chat/Composer/attachments";

export function useSessionCreation({
  attachmentsRef,
  draftRevision,
  flushDraft,
  hookOverrides,
  mcpOverrides,
  message,
  model,
  onCreate,
  optionsReady,
  pairs,
  workspace,
}: {
  attachmentsRef: RefObject<PendingAttachments>;
  draftRevision: number;
  flushDraft: () => Promise<void>;
  hookOverrides: Record<string, boolean>;
  mcpOverrides: Record<string, boolean>;
  message: string;
  model: string;
  onCreate: (state: InitialSessionState, attachments: PendingAttachment[]) => Promise<void>;
  optionsReady: boolean;
  pairs: EditablePair[];
  workspace: string;
}) {
  "use no memo";
  const [submitting, setSubmitting] = useState(false),
    submittingRef = useRef(false);
  const submit = async () => {
      const valid =
        optionsReady &&
        model.trim().length > 0 &&
        workspace.trim().length > 0 &&
        message.trim().length > 0 &&
        pairs.every(({ user, assistant }) => user.trim().length > 0 && assistant.trim().length > 0);
      if (!valid || submittingRef.current) {
        return;
      }
      submittingRef.current = true;
      setSubmitting(true);
      try {
        await flushDraft();
        await onCreate(
          {
            draftRevision,
            history: pairs.map(({ user, assistant }) => ({ assistant, user })),
            hookOverrides,
            mcpOverrides,
            message,
            model: model.trim(),
          },
          attachmentsRef.current.values(message),
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
  return { handleFormSubmit, handleSubmit, submitting };
}
