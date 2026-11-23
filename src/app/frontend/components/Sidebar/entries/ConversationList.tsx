import { type MouseEvent, useCallback } from "react";

import { useTranslation } from "../../../i18n";
import { navigateLink, pagePath } from "../../../route";
import type { SessionInfo } from "../../../services/client";
import { conversationEntry, sessions } from "./itemRecipe";
import { OverflowCaption } from "./OverflowCaption";
import { RelativeTime } from "./RelativeTime";
import { Status } from "./Status";

interface Props {
  activeId?: string;
  unreadIds: ReadonlySet<string>;
  sessions: SessionInfo[];
  onSelect: (id: string) => void;
}
interface SessionItemProps {
  active: boolean;
  language: string;
  onSelect: Props["onSelect"];
  session: SessionInfo;
  unread: boolean;
}
function SessionItem({ active, language, onSelect, session, unread }: SessionItemProps) {
  const { t } = useTranslation(),
    title = session.title === session.id ? session.id.toUpperCase() : session.title,
    classes = conversationEntry({ active, unread }),
    handleSelect = useCallback(
      (event: MouseEvent<HTMLAnchorElement>) => {
        navigateLink(event, () => onSelect(session.id));
      },
      [onSelect, session.id],
    );
  return (
    <li className={classes.root}>
      <a
        aria-current={active ? "page" : undefined}
        aria-label={unread ? `${title}, ${t("shell:sessionStoppedUnread")}` : title}
        className={classes.trigger}
        href={pagePath({ id: session.id, kind: "session" })}
        onClick={handleSelect}
        title={`${title}${unread ? ` · ${t("shell:sessionStoppedUnread")}` : ""}\n${session.workspace}`}
      >
        <OverflowCaption className={classes.caption} text={title} />
        <Status compact error={session.error} status={session.status} />
        <RelativeTime className={classes.time} locale={language} updatedAt={session.updatedAt} />
      </a>
    </li>
  );
}
export function ConversationList({ activeId, unreadIds, sessions: source, onSelect }: Props) {
  const { i18n } = useTranslation();
  return (
    <ul className={sessions}>
      {source.map((session) => (
        <SessionItem
          active={session.id === activeId}
          key={session.id}
          language={i18n.language}
          onSelect={onSelect}
          session={session}
          unread={unreadIds.has(session.id)}
        />
      ))}
    </ul>
  );
}
