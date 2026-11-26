import { useTranslation } from "react-i18next";

import { isRunningStatus, type PlaybackControl, type SessionStatus } from "../../../../types";
import type { AttachmentSettings, PendingAttachment } from "../../../attachments/contract";
import type { InitialSessionState } from "../../../initialState";
import type { TimelineMessage } from "../../../timeline";
import type { FrontendSettings } from "../../services/client";
import { composerDraftKey, type ComposerDraftTarget } from "../../services/composerDrafts";
import type { useNewSessionDraft } from "../../services/preparation/editorState";
import { usePredictions } from "../../services/queries";
import type { OptimisticUser } from "../../services/transcript/optimistic";
import { useTranslatedTranscript } from "../../services/translation/useTranslatedTranscript";
import { FileLinkProvider } from "../FileLink/context";
import { NewSessionPage } from "../NewSession";
import { Transcript } from "../Transcript";
import { Composer } from "./Composer";
import { chatPage, emptyChat } from "./layout";
import type { AskUserAnswer, AskUserQuestion } from "./toolActions";

export function ChatPage({
  activeId,
  actionPending = false,
  allowFork = true,
  attachmentSettings,
  cacheHitWarningRatio,
  draft,
  draftSaveDelayMs,
  draftTarget,
  newSession,
  profileChangePending = false,
  profileEditable = false,
  preparation,
  recentWorkspaces,
  availableProfiles,
  selectedProfile,
  sessionStatus,
  stepAvailable,
  translationSettings,
  view,
  userMessages,
  onCreate,
  onCancelTool,
  onSend,
  askUser,
  onAnswer,
  onControl,
  onDelete,
  onFork,
  onPickWorkspace,
  onProfileChange,
}: {
  activeId?: string;
  actionPending?: boolean;
  allowFork?: boolean;
  attachmentSettings?: AttachmentSettings;
  cacheHitWarningRatio?: number;
  draft?: string;
  draftSaveDelayMs?: number;
  draftTarget: ComposerDraftTarget;
  newSession: boolean;
  profileChangePending?: boolean;
  profileEditable?: boolean;
  preparation?: ReturnType<typeof useNewSessionDraft>;
  recentWorkspaces: string[];
  availableProfiles: string[];
  selectedProfile?: string;
  sessionStatus?: SessionStatus;
  stepAvailable?: boolean;
  translationSettings?: FrontendSettings["reasoningTranslation"];
  view: TimelineMessage[];
  userMessages: readonly string[];
  onCreate: (state: InitialSessionState, attachments: PendingAttachment[]) => Promise<void>;
  onCancelTool: (toolCallId: string) => Promise<void>;
  onSend: (
    optimistic: OptimisticUser,
    draftRevision: number,
    attachments: PendingAttachment[],
  ) => Promise<void>;
  askUser: AskUserQuestion | null;
  onAnswer: (callId: string, answer: AskUserAnswer) => Promise<void>;
  onControl: (control: PlaybackControl) => Promise<void>;
  onDelete?: () => Promise<void>;
  onFork: (messageId: number) => Promise<void>;
  onPickWorkspace: () => Promise<string | null>;
  onProfileChange: (profile?: string) => void;
}) {
  const { t } = useTranslation(["conversation", "shell"]),
    predictionsQuery = usePredictions(activeId, sessionStatus === "idle"),
    running = isRunningStatus(sessionStatus),
    latestUsage = view.findLast((item) => item.usage !== undefined)?.usage ?? null,
    translatedView = useTranslatedTranscript(activeId ?? "", view, translationSettings);
  if (!activeId) {
    if (newSession && preparation) {
      return (
        <NewSessionPage
          pageClassName={chatPage}
          preparation={preparation}
          recentWorkspaces={recentWorkspaces}
          availableProfiles={availableProfiles}
          onCreate={onCreate}
          onPickWorkspace={onPickWorkspace}
          userMessages={userMessages}
        />
      );
    }
    return (
      <div className={chatPage}>
        <div className={emptyChat}>{t("shell:empty")}</div>
      </div>
    );
  }
  return (
    <div className={chatPage}>
      <FileLinkProvider sessionId={activeId}>
        {view.length === 0 ? (
          <div className={emptyChat}>{t("noMessages")}</div>
        ) : (
          <Transcript
            allowFork={allowFork}
            forkDisabled={actionPending || running}
            key={activeId}
            messages={translatedView}
            onFork={onFork}
            onCancelTool={onCancelTool}
          />
        )}
      </FileLinkProvider>
      <Composer
        attachmentSettings={attachmentSettings}
        cacheHitWarningRatio={cacheHitWarningRatio}
        askUser={askUser}
        controlDisabled={actionPending}
        deleteDisabled={actionPending || running}
        disabled={!activeId || actionPending}
        draft={draft}
        draftSaveDelayMs={draftSaveDelayMs}
        draftTarget={draftTarget}
        availableProfiles={profileEditable ? availableProfiles : undefined}
        currentProfile={profileEditable ? selectedProfile : undefined}
        profileChangeDisabled={profileChangePending || running}
        profileChangePending={profileChangePending}
        key={composerDraftKey(draftTarget)}
        predictions={
          sessionStatus === "idle" && !predictionsQuery.isFetching && !predictionsQuery.isError
            ? predictionsQuery.data?.predictions
            : undefined
        }
        userMessages={userMessages}
        usage={latestUsage}
        sessionStatus={sessionStatus}
        stepAvailable={stepAvailable}
        onControl={onControl}
        onDelete={onDelete}
        onAnswer={onAnswer}
        onProfileChange={profileEditable ? onProfileChange : undefined}
        onSend={onSend}
      />
    </div>
  );
}
