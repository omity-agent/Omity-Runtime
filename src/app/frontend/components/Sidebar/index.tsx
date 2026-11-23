import { Activity, Folder, MessagesSquare, Plus } from "lucide-react";
import { type MouseEvent, useCallback, useId, useState } from "react";

import { useTranslation } from "../../i18n";
import { navigateLink, pagePath } from "../../route";
import type { SessionInfo } from "../../services/client";
import { CredentialAction } from "../Access/CredentialAction";
import { LinkButton } from "../ui";
import { ConversationList } from "./entries/ConversationList";
import { collections, heading, list, section, title, toolbar, total } from "./panelStyles";
import { ProjectPicker } from "./ProjectPicker";
import { groupSessions, recentSessions, workspaceLabel } from "./sessions";

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
    [selectedWorkspace, setSelectedWorkspace] = useState<string>(),
    groups = groupSessions(sessions),
    project =
      groups.find(({ workspace }) => workspace === selectedWorkspace) ??
      groups.find(({ sessions: projectSessions }) =>
        projectSessions.some(({ id }) => id === activeId),
      ) ??
      groups[0],
    recent = recentSessions(sessions, unreadIds),
    handleCreate = useCallback(
      (event: MouseEvent<HTMLAnchorElement>) => navigateLink(event, onCreate),
      [onCreate],
    );
  if (selectedWorkspace !== project?.workspace) {
    setSelectedWorkspace(project?.workspace);
  }
  return (
    <>
      <header className={toolbar}>
        {showCreate && (
          <LinkButton
            aria-label={t("shell:newSession")}
            href={pagePath({ kind: "new" })}
            iconOnly
            onClick={handleCreate}
            title={t("shell:newSession")}
            visual="ghost"
          >
            <Plus aria-hidden size={16} />
          </LinkButton>
        )}
        <CredentialAction />
      </header>
      <nav aria-label={t("shell:sessions")} className={collections}>
        <section aria-label={t("shell:recentSessions")} className={section}>
          <h2 className={heading}>
            <Activity aria-hidden size={14} />
            <span className={title}>{t("shell:recentSessions")}</span>
            <span className={total}>{recent.length}</span>
          </h2>
          <div className={list}>
            {recent.length > 0 ? (
              <ConversationList
                activeId={activeId}
                onSelect={onSelect}
                sessions={recent}
                unreadIds={unreadIds}
              />
            ) : null}
          </div>
        </section>
        <section aria-label={t("shell:projects")} className={section}>
          <h2 className={heading}>
            <Folder aria-hidden size={14} />
            <span className={title}>{t("shell:projects")}</span>
            <span className={total}>{groups.length}</span>
          </h2>
          <div className={list}>
            {groups.length > 0 ? (
              <ProjectPicker
                groups={groups}
                onSelect={setSelectedWorkspace}
                selectedWorkspace={project?.workspace}
                sessionsId={sessionsId}
                unreadIds={unreadIds}
              />
            ) : null}
          </div>
        </section>
        <section aria-label={t("shell:projectSessions")} className={section} id={sessionsId}>
          <h2 className={heading} title={project?.workspace}>
            <MessagesSquare aria-hidden size={14} />
            <span className={title}>
              {project ? workspaceLabel(project.workspace) : t("shell:projectSessions")}
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
