import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import type { PlaybackControl } from "../../../../types";
import type { PendingAttachment } from "../../../attachments/contract";
import { localize } from "../../i18n";
import { type ForkPage, forkPage, sessionPage, type usePageRouting } from "../../route";
import {
  deleteSession,
  loadComposerDraft,
  materializeFork,
  saveComposerDraft,
  setControl,
} from "../client";
import {
  clearTemporaryComposerDraft,
  composerDraftKey,
  readComposerDraft,
} from "../composerDrafts";
import { addSession, removeSession } from "../queries";
import type { OptimisticUser } from "./optimistic";

type SubmitMessage = (
  optimistic: OptimisticUser,
  draftRevision: number,
  attachments: PendingAttachment[],
) => Promise<void>;
type ForkAction =
  | { kind: "control"; value: PlaybackControl }
  | { kind: "discard" }
  | {
      kind: "send";
      optimistic: OptimisticUser;
      draftRevision: number;
      attachments: PendingAttachment[];
    };
export function usePendingFork({
  captureNavigation,
  navigate,
  page,
  submit,
}: Pick<ReturnType<typeof usePageRouting>, "captureNavigation" | "navigate"> & {
  page?: ForkPage;
  submit: SubmitMessage;
}) {
  const queryClient = useQueryClient(),
    [action, setAction] = useState<ForkAction>(),
    locked = useRef(false),
    materialized = useRef(new Map<string, string>());
  async function run(next: ForkAction) {
    if (!page) {
      throw new Error(localize("diagnostics:fork.pendingSessionMissing"));
    }
    if (locked.current) {
      throw new Error(localize("diagnostics:fork.actionInProgress"));
    }
    const canNavigate = captureNavigation(page),
      key = composerDraftKey(page),
      sessions = materialized.current;
    let sessionId = sessions.get(key);
    locked.current = true;
    setAction(next);
    try {
      if (next.kind === "discard") {
        if (sessionId !== undefined) {
          await deleteSession(sessionId);
          removeSession(queryClient, sessionId);
        }
        sessionId = page.sourceSessionId;
      } else {
        if (sessionId === undefined) {
          const { session } = await materializeFork(page.sourceSessionId, page.beforeMessageId);
          sessionId = session.id;
          sessions.set(key, sessionId);
          addSession(queryClient, session);
        }
        if (next.kind === "control") {
          await transferDraft(page, sessionId);
          await setControl(sessionId, next.value);
        } else {
          await submit({ ...next.optimistic, sessionId }, next.draftRevision, next.attachments);
        }
      }
      sessions.delete(key);
      clearTemporaryComposerDraft(page);
      if (canNavigate()) {
        navigate(sessionPage(sessionId), true);
      }
    } finally {
      locked.current = false;
      setAction(undefined);
    }
  }
  return {
    begin: (sourceSessionId: string, beforeMessageId: number) => {
      if (!page && !locked.current) {
        materialized.current.clear();
      }
      navigate(forkPage(sourceSessionId, beforeMessageId), page !== undefined);
    },
    busy: page !== undefined && action !== undefined,
    control: (value: PlaybackControl) => run({ kind: "control", value }),
    discard: () => run({ kind: "discard" }),
    pendingMessage:
      action?.kind === "send" && page && action.optimistic.sessionId === composerDraftKey(page)
        ? action.optimistic
        : null,
    send: (...[optimistic, draftRevision, attachments]: Parameters<SubmitMessage>) =>
      run({ attachments, draftRevision, kind: "send", optimistic }),
  };
}
async function transferDraft(page: ForkPage, sessionId: string) {
  const [draft, current] = await Promise.all([
    readComposerDraft(page, ""),
    loadComposerDraft(sessionId),
  ]);
  if (current.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error(localize("diagnostics:fork.revisionOverflow", { value0: sessionId }));
  }
  await saveComposerDraft(sessionId, draft.content, Math.max(current.revision + 1, draft.revision));
}
