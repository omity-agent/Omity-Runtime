import type { QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { AttachmentSettings, PendingAttachment } from "../../../attachments/contract";
import type { InitialSessionState } from "../../../initialState";
import { type Page, sessionPage } from "../../route";
import { createSession } from "../client";
import { addSession } from "../queries";
import { useNewSessionDraft } from "./editorState";

export function useNewSession({
  attachmentSettings,
  captureNavigation,
  cwd,
  enabled,
  navigate,
  queryClient,
  saveDelayMs,
  sourceWorkspace,
}: {
  attachmentSettings?: AttachmentSettings;
  captureNavigation: () => () => boolean;
  cwd: string;
  enabled: boolean;
  navigate: (page: Page) => void;
  queryClient: QueryClient;
  saveDelayMs?: number;
  sourceWorkspace?: string;
}) {
  const preparation = useNewSessionDraft({
      attachmentSettings,
      defaultWorkspace: cwd,
      enabled,
      saveDelayMs,
    }),
    open = () => {
      if (!preparation.loading && preparation.draft.workspace === undefined && sourceWorkspace) {
        preparation.update({ workspace: sourceWorkspace });
      }
      navigate({ kind: "new" });
    },
    create = useCallback(
      async (initialState: InitialSessionState, attachments: PendingAttachment[]) => {
        const canNavigate = captureNavigation();
        await preparation.flush();
        const result = await createSession(
          preparation.workspace,
          preparation.draft.profile,
          initialState,
          attachments,
        );
        addSession(queryClient, result.session);
        await preparation.clear(initialState.draftRevision ?? 0);
        if (canNavigate()) {
          navigate(sessionPage(result.session.id));
        }
      },
      [captureNavigation, navigate, preparation, queryClient],
    );
  return {
    create,
    open,
    preparation,
  };
}
