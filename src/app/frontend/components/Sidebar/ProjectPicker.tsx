import { Folder, FolderOpen } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { css, cx } from "styled-system/css";

import { Button } from "../ui";
import { type WorkspaceGroup, workspaceLabel } from "./sessions";

const projects = css({ display: "grid", gap: "1", paddingBlockEnd: "2" }),
  button = css({
    _hover: { background: "bg.hover" },
    alignItems: "center",
    borderRadius: "md",
    color: "fg.muted",
    display: "grid",
    gap: "2",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    height: "auto",
    justifyContent: "stretch",
    paddingBlock: "2",
    paddingInline: "2",
    textAlign: "left",
    width: "full",
  }),
  selected = css({
    background: "bg.emphasized",
    color: "fg.default",
  }),
  name = css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
  counts = css({
    alignItems: "center",
    color: "fg.subtle",
    display: "flex",
    fontSize: "metadata",
    gap: "1.5",
  }),
  attention = css({ color: "status.model" });
interface Props {
  groups: WorkspaceGroup[];
  selectedWorkspace?: string;
  sessionsId: string;
  unreadIds: ReadonlySet<string>;
  onSelect: (workspace: string) => void;
}
export function ProjectPicker({
  groups,
  selectedWorkspace,
  sessionsId,
  unreadIds,
  onSelect,
}: Props) {
  return (
    <ul className={projects}>
      {groups.map((group) => (
        <ProjectItem
          active={group.workspace === selectedWorkspace}
          group={group}
          key={group.workspace}
          onSelect={onSelect}
          sessionsId={sessionsId}
          unread={group.sessions.filter(({ id }) => unreadIds.has(id)).length}
        />
      ))}
    </ul>
  );
}
function ProjectItem({
  active,
  group,
  onSelect,
  sessionsId,
  unread,
}: {
  active: boolean;
  group: WorkspaceGroup;
  onSelect: Props["onSelect"];
  sessionsId: string;
  unread: number;
}) {
  const { t } = useTranslation("shell"),
    select = useCallback(() => onSelect(group.workspace), [group.workspace, onSelect]),
    Icon = active ? FolderOpen : Folder;
  return (
    <li>
      <Button
        aria-controls={sessionsId}
        aria-pressed={active}
        className={cx(button, active && selected)}
        onClick={select}
        title={group.workspace}
        type="button"
        visual="ghost"
      >
        <Icon aria-hidden size={14} />
        <span className={name}>{workspaceLabel(group.workspace)}</span>
        <span className={counts}>
          {group.runningCount > 0 && (
            <span
              aria-label={t("runningSessionCount", { count: group.runningCount })}
              className={attention}
            >
              ● {group.runningCount}
            </span>
          )}
          {unread > 0 && (
            <span aria-label={t("unreadSessionCount", { count: unread })} className={attention}>
              ● {unread}
            </span>
          )}
          <span>{group.sessions.length}</span>
        </span>
      </Button>
    </li>
  );
}
