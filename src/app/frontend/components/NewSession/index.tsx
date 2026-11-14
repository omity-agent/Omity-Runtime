import { useCallback, useLayoutEffect, useRef } from "react";

import type { PendingAttachment } from "../../../attachments/contract";
import type { InitialSessionState } from "../../../initialState";
import type { useNewSessionDraft } from "../../services/preparation/editorState";
import { LatestMessage } from "./editor/LatestMessage";
import { useSessionCreation } from "./editor/submission";
import { MessageStack } from "./MessageStack";
import { ConfigurationPanel } from "./options/ConfigurationPanel";
import { useSessionPreferences } from "./options/preferences";
import { scroll, scrollContent, setup } from "./preparationGrid";
import { WorkspacePicker } from "./WorkspacePicker";

export function NewSessionPage({
  pageClassName,
  preparation,
  recentWorkspaces,
  availableProfiles,
  userMessages,
  onCreate,
  onPickWorkspace,
}: {
  pageClassName: string;
  preparation: ReturnType<typeof useNewSessionDraft>;
  recentWorkspaces: string[];
  availableProfiles: string[];
  userMessages: readonly string[];
  onCreate: (state: InitialSessionState, attachments: PendingAttachment[]) => Promise<void>;
  onPickWorkspace: () => Promise<string | null>;
}) {
  const selection = useSessionPreferences(preparation),
    {
      addPair,
      attachmentsRef,
      changePair,
      draft: { message, pairs },
      flush: flushDraft,
      loading: draftLoading,
      pasteFiles,
      removePair,
      revision: draftRevision,
      update,
      updateMessage,
      workspace,
    } = preparation,
    scrollRef = useRef<HTMLDivElement>(null),
    previousPairCountRef = useRef(pairs.length);
  useLayoutEffect(() => {
    const pairAdded = pairs.length > previousPairCountRef.current;
    previousPairCountRef.current = pairs.length;
    const keepLastMessageInPlace = () => {
      const node = scrollRef.current;
      if (node) {
        node.scrollTop = node.scrollHeight;
      }
    };
    let frame: number | undefined;
    if (pairAdded) {
      keepLastMessageInPlace();
      frame = requestAnimationFrame(keepLastMessageInPlace);
    }
    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }, [pairs.length]);
  const { handleFormSubmit, handleSubmit, submitting } = useSessionCreation({
      attachmentsRef,
      draftRevision,
      flushDraft,
      hookOverrides: selection.hookOverrides,
      mcpOverrides: selection.mcpOverrides,
      message,
      model: selection.model,
      onCreate,
      optionsReady: !draftLoading && selection.ready,
      pairs,
      workspace,
    }),
    complete =
      workspace.trim().length > 0 &&
      message.trim().length > 0 &&
      pairs.every(({ user, assistant }) => user.trim().length > 0 && assistant.trim().length > 0),
    changeWorkspace = useCallback((value: string) => update({ workspace: value }), [update]),
    changeProfile = useCallback((profile?: string) => update({ profile }), [update]);
  return (
    <form className={pageClassName} onSubmit={handleFormSubmit}>
      <div className={scroll} ref={scrollRef}>
        <div className={scrollContent}>
          <div className={setup}>
            <WorkspacePicker
              disabled={draftLoading || submitting}
              recentWorkspaces={recentWorkspaces}
              workspace={workspace}
              onChange={changeWorkspace}
              onPick={onPickWorkspace}
            />
            <ConfigurationPanel
              availableProfiles={availableProfiles}
              disabled={draftLoading || submitting}
              onProfileChange={changeProfile}
              selectedProfile={preparation.draft.profile}
              selection={selection}
            />
          </div>
          <div>
            <MessageStack
              disabled={draftLoading || submitting}
              pairs={pairs}
              onPairChange={changePair}
              onRemove={removePair}
              onSubmit={handleSubmit}
            />
            <LatestMessage
              disabled={draftLoading || submitting}
              message={message}
              submitDisabled={draftLoading || !selection.valid || !complete || submitting}
              submitting={submitting}
              userMessages={userMessages}
              onAddPair={addPair}
              onChange={updateMessage}
              onPasteFiles={pasteFiles}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
