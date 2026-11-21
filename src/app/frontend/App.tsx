import { useQueryClient } from "@tanstack/react-query";
import { type ComponentProps, useCallback, useMemo, useState } from "react";

import { AccessGate } from "./components/Access/AccessGate";
import { ApplicationFrame } from "./components/Application";
import { ChatPage } from "./components/Chat/ChatPage";
import { useSessionToolActions } from "./components/Chat/toolActions";
import {
  pagePath,
  readPage,
  resolvePage,
  transcriptSessionId,
  usePageNavigation,
  usePageNavigator,
} from "./route";
import { deleteSession, pickWorkspacePath, type SessionInfo } from "./services/client";
import {
  createControlChangeHandler,
  createProfileChangeHandler,
} from "./services/interactionHandlers";
import { useNewSession } from "./services/preparation/newSession";
import { removeSession, useBootstrap, useUserMessages } from "./services/queries";
import { recentWorkspaces } from "./services/recentWorkspaces";
import { useForkableTranscript } from "./services/transcript/fork";

const emptySessions: SessionInfo[] = [],
  emptyProfiles: string[] = [];
type ChatPageProps = ComponentProps<typeof ChatPage>;
export function App() {
  return (
    <AccessGate>
      <AuthenticatedApp />
    </AccessGate>
  );
}
function AuthenticatedApp() {
  const queryClient = useQueryClient(),
    bootstrap = useBootstrap(),
    userMessages = useUserMessages(),
    [page, setPage] = useState(readPage),
    [deletingId, setDeletingId] = useState<string>(),
    [profileChangePending, setProfileChangePending] = useState(false),
    navigate = usePageNavigator(setPage),
    sessions = bootstrap.data?.sessions ?? emptySessions,
    cwd = bootstrap.data?.cwd ?? "",
    currentPage = resolvePage(page, sessions, bootstrap.data !== undefined),
    pageKey = pagePath(currentPage),
    pendingFork = currentPage.kind === "fork" ? currentPage : undefined,
    activeSession =
      currentPage.kind === "session"
        ? sessions.find((session) => session.id === currentPage.id)
        : undefined,
    sourceSession = pendingFork
      ? sessions.find((session) => session.id === pendingFork.sourceSessionId)
      : activeSession,
    {
      busy: forkActionPending,
      draftTarget,
      flow: {
        begin: beginPendingFork,
        control: controlPendingFork,
        discard: discardPendingFork,
        send: sendPendingFork,
      },
      pendingPreview,
      submissions,
    } = useForkableTranscript({
      activeSessionId: activeSession?.id,
      navigate,
      page: pendingFork,
      snapshotThrottleMs: bootstrap.data?.frontend.transcriptSnapshotThrottleMs,
      sourceSessionId: transcriptSessionId(sourceSession?.id, deletingId),
    }),
    {
      create: createNewSession,
      open: openNewSession,
      preparation,
    } = useNewSession({
      attachmentSettings: bootstrap.data?.attachments,
      cwd,
      enabled: bootstrap.data !== undefined,
      navigate,
      queryClient,
      saveDelayMs: bootstrap.data?.frontend.draftSaveDelayMs,
      sourceWorkspace: sourceSession?.workspace,
    });
  usePageNavigation(page, currentPage, setPage);
  const workspaces = useMemo(() => recentWorkspaces(sessions), [sessions]),
    userMessageContents = useMemo(
      () => userMessages.data?.messages.map(({ content }) => content) ?? [],
      [userMessages.data],
    ),
    selectSession = useCallback((id: string) => navigate({ id, kind: "session" }), [navigate]),
    changeProfile = createProfileChangeHandler({
      activeSession,
      pendingFork: Boolean(pendingFork),
      profileChangePending,
      queryClient,
      setProfileChangePending,
    }),
    toolActions = useSessionToolActions(activeSession),
    changeControl = createControlChangeHandler({
      activeSessionId: activeSession?.id,
      controlPendingFork,
      pendingFork: Boolean(pendingFork),
    }),
    deleteActiveSession = useCallback(async () => {
      if (pendingFork) {
        await discardPendingFork();
        return;
      }
      if (!activeSession) {
        return;
      }
      const sessionId = activeSession.id;
      setDeletingId(sessionId);
      await deleteSession(sessionId).finally(() => {
        setDeletingId(undefined);
      });
      removeSession(queryClient, sessionId);
      navigate({ kind: "new" });
    }, [activeSession, discardPendingFork, navigate, pendingFork, queryClient, setDeletingId]),
    beginFork = useCallback<ChatPageProps["onFork"]>(
      (messageId) =>
        Promise.try(() => {
          const sourceSessionId = pendingFork?.sourceSessionId ?? activeSession?.id;
          if (!sourceSessionId) {
            return;
          }
          beginPendingFork(sourceSessionId, messageId);
        }),
      [activeSession, beginPendingFork, pendingFork],
    ),
    sendSessionMessage = pendingFork ? sendPendingFork : submissions.send;
  return (
    <ApplicationFrame
      activeSession={activeSession}
      pageKey={pageKey}
      showCreate={currentPage.kind !== "new"}
      sessions={sessions}
      title={sourceSession?.title}
      onCreate={openNewSession}
      onSelect={selectSession}
    >
      <ChatPage
        activeId={sourceSession?.id}
        actionPending={forkActionPending}
        allowFork={!pendingFork}
        attachmentSettings={bootstrap.data?.attachments}
        cacheHitWarningRatio={bootstrap.data?.frontend.cacheHitWarningRatio}
        draft={pendingPreview?.draft}
        draftSaveDelayMs={bootstrap.data?.frontend.draftSaveDelayMs}
        draftTarget={draftTarget}
        newSession={currentPage.kind === "new"}
        profileChangePending={profileChangePending}
        profileEditable={Boolean(activeSession && !pendingFork)}
        preparation={preparation}
        recentWorkspaces={workspaces}
        availableProfiles={bootstrap.data?.profiles.available ?? emptyProfiles}
        selectedProfile={activeSession?.profile}
        sessionStatus={pendingFork ? "paused" : activeSession?.status}
        stepAvailable={activeSession?.stepAvailable}
        translationSettings={bootstrap.data?.frontend.reasoningTranslation}
        view={pendingPreview?.view ?? submissions.view}
        userMessages={userMessageContents}
        onCreate={createNewSession}
        onCancelTool={toolActions.handleCancel}
        askUser={activeSession?.askUser ?? null}
        onAnswer={toolActions.handleAnswer}
        onControl={changeControl}
        onDelete={deleteActiveSession}
        onFork={beginFork}
        onPickWorkspace={pickWorkspacePath}
        onProfileChange={changeProfile}
        onSend={sendSessionMessage}
      />
    </ApplicationFrame>
  );
}
