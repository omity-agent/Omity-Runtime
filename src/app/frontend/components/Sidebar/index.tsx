import { Activity, Folder, MessagesSquare, Plus } from "lucide-react";
import { type MouseEvent, useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { navigateLink, pagePath } from "../../route";
import type { SessionInfo } from "../../services/client";
import { LinkButton } from "../ParkUI";
import { ConversationList } from "./entries/ConversationList";
import {
  brand,
  collections,
  heading,
  list,
  newButton,
  panel,
  section,
  title,
  total,
} from "./panelStyles";
import { ProjectPicker } from "./ProjectPicker";
import { compareSessions, groupSessions, isRunning, workspaceLabel } from "./sessions";

interface SidebarProps {
  sessions: SessionInfo[];
  activeId?: string;
  showCreate: boolean;
  unreadIds: ReadonlySet<string>;
  onCreate: () => void;
  onSelect: (id: string) => void;
}
export function Sidebar({
  sessions,
  activeId,
  showCreate,
  unreadIds,
  onCreate,
  onSelect,
}: SidebarProps) {
  const { t } = useTranslation(),
    sessionsId = useId(),
    activeWorkspace = sessions.find(({ id }) => id === activeId)?.workspace,
    [selection, setSelection] = useState({ activeWorkspace, workspace: activeWorkspace }),
    groups = groupSessions(sessions),
    project = groups.find(({ workspace }) => workspace === selection.workspace) ?? groups[0],
    attentionSessions = sessions
      .filter((session) => isRunning(session) || unreadIds.has(session.id))
      .toSorted(compareSessions),
    selectProject = useCallback(
      (workspace: string) => {
        setSelection({ activeWorkspace, workspace });
      },
      [activeWorkspace],
    ),
    handleCreate = useCallback(
      (event: MouseEvent<HTMLAnchorElement>) => navigateLink(event, onCreate),
      [onCreate],
    );
  if (selection.activeWorkspace !== activeWorkspace) {
    setSelection({ activeWorkspace, workspace: activeWorkspace ?? selection.workspace });
  }
  return (
    <>
      <header className={panel}>
        <h1 className={brand}>
          {t("brand")} <span className={total}>/ {sessions.length}</span>
        </h1>
        {showCreate && (
          <LinkButton
            aria-label={t("newSession")}
            className={newButton}
            href={pagePath({ kind: "new" })}
            onClick={handleCreate}
            title={t("newSession")}
          >
            <Plus size={14} />
            {t("new")}
          </LinkButton>
        )}
      </header>
      <nav aria-label={t("sessions")} className={collections}>
        <section aria-label={t("runningAndUnread")} className={section}>
          <h2 className={heading}>
            <Activity aria-hidden size={14} />
            <span className={title}>{t("runningAndUnread")}</span>
            <span className={total}>{attentionSessions.length}</span>
          </h2>
          <div className={list}>
            {attentionSessions.length > 0 ? (
              <ConversationList
                activeId={activeId}
                onSelect={onSelect}
                sessions={attentionSessions}
                unreadIds={unreadIds}
              />
            ) : null}
          </div>
        </section>
        <section aria-label={t("projects")} className={section}>
          <h2 className={heading}>
            <Folder aria-hidden size={14} />
            <span className={title}>{t("projects")}</span>
            <span className={total}>{groups.length}</span>
          </h2>
          <div className={list}>
            {groups.length > 0 ? (
              <ProjectPicker
                groups={groups}
                onSelect={selectProject}
                selectedWorkspace={project?.workspace}
                sessionsId={sessionsId}
                unreadIds={unreadIds}
              />
            ) : null}
          </div>
        </section>
        <section aria-label={t("projectSessions")} className={section} id={sessionsId}>
          <h2 className={heading} title={project?.workspace}>
            <MessagesSquare aria-hidden size={14} />
            <span className={title}>
              {project ? workspaceLabel(project.workspace) : t("projectSessions")}
            </span>
            <span className={total}>{project?.sessions.length ?? 0}</span>
          </h2>
          <div className={list} key={project?.workspace}>
            {project ? (
              <ConversationList
                activeId={activeId}
                onSelect={onSelect}
                sessions={project.sessions}
                unreadIds={unreadIds}
              />
            ) : null}
          </div>
        </section>
      </nav>
    </>
  );
}
