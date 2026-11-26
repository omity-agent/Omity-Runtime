import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

import type { PendingAttachment } from "../../../attachments/contract";
import type { InitialSessionState } from "../../../initialState";
import type { useNewSessionDraft } from "../../services/preparation/editorState";
import { usePreparationCandidates } from "./editor/historyCandidates";
import { useSessionCreation } from "./editor/submission";
import { MessageStack } from "./MessageStack";
import { ModelFields } from "./ModelFields";
import { CapabilityPanels } from "./options/CapabilityPanels";
import { useSessionPreferences } from "./options/preferences";
import { primaryFields, scroll, scrollContent, setup } from "./setupLayout";
import { RecentWorkspaces, WorkspacePicker } from "./WorkspacePicker";

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
      appendPair,
      attachmentsRef,
      changePair,
      draft: { message, pairs },
      loading: draftLoading,
      pasteFiles,
      pendingPairId,
      removePair,
      revision: draftRevision,
      update,
      updateMessage,
      workspace,
    } = preparation,
    scrollRef = useRef<HTMLDivElement>(null),
    previousPairCountRef = useRef(pairs.length);
  useLayoutEffect(() => {
    const appended = pairs.length > previousPairCountRef.current,
      node = scrollRef.current;
    previousPairCountRef.current = pairs.length;
    if (!node || !appended) {
      return undefined;
    }
    const followTail = () => {
      node.scrollTop = node.scrollHeight;
    };
    followTail();
    const frame = requestAnimationFrame(followTail);
    return () => cancelAnimationFrame(frame);
  }, [pairs.length]);
  const { bind, reset } = usePreparationCandidates(userMessages),
    latest = bind(pendingPairId, message, updateMessage),
    { content: input } = latest,
    editors = useMemo(
      () =>
        pairs.map(({ assistant, id, user }) => ({
          assistant: bind(`${id}:assistant`, assistant, (content) =>
            changePair(id, { assistant: content }),
          ),
          id,
          user: bind(id, user, (content) => changePair(id, { user: content })),
        })),
      [bind, changePair, pairs],
    ),
    handleAppend = useCallback(() => {
      appendPair(input);
      reset(pendingPairId);
    }, [appendPair, input, pendingPairId, reset]),
    handleRemove = useCallback(
      (id: string) => {
        removePair(id);
        reset(id);
        reset(`${id}:assistant`);
      },
      [removePair, reset],
    ),
    { handleFormSubmit, handleSubmit, submitDisabled, submitting } = useSessionCreation({
      attachmentsRef,
      onCreate,
      optionsReady: !draftLoading && selection.valid,
      state: {
        builtInOverrides: selection.builtInOverrides,
        draftRevision,
        history: editors.map(({ assistant, user }) => ({
          assistant: assistant.content,
          user: user.content,
        })),
        hookOverrides: selection.hookOverrides,
        mcpOverrides: selection.mcpOverrides,
        message: input,
        model: selection.model,
        promptSelection: selection.promptSelection,
      },
      workspace,
    }),
    changeWorkspace = useCallback((value: string) => update({ workspace: value }), [update]),
    changeProfile = useCallback((profile?: string) => update({ profile }), [update]),
    disabled = draftLoading || submitting;
  return (
    <form className={pageClassName} onSubmit={handleFormSubmit}>
      <div className={scroll} ref={scrollRef}>
        <div className={scrollContent}>
          <div className={setup}>
            <div className={primaryFields}>
              <WorkspacePicker
                disabled={disabled}
                workspace={workspace}
                onChange={changeWorkspace}
                onPick={onPickWorkspace}
              />
              <ModelFields
                availableProfiles={availableProfiles}
                disabled={disabled}
                model={selection.model}
                modelDisabled={!selection.ready}
                onModelChange={selection.handleModelChange}
                onProfileChange={changeProfile}
                profile={preparation.draft.profile}
              />
              <RecentWorkspaces
                disabled={disabled}
                items={recentWorkspaces}
                onChange={changeWorkspace}
                workspace={workspace}
              />
            </div>
            <CapabilityPanels disabled={disabled} selection={selection} />
          </div>
          <MessageStack
            disabled={disabled}
            latest={latest}
            onAppend={handleAppend}
            onPasteFiles={pasteFiles}
            onRemove={handleRemove}
            onSubmit={handleSubmit}
            pairs={editors}
            submitDisabled={submitDisabled}
            submitting={submitting}
          />
        </div>
      </div>
    </form>
  );
}
