import { type MouseEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "styled-system/css";

import { navigateLink, pagePath } from "../../../route";
import type { SessionInfo } from "../../../services/client";
import { LinkButton } from "../../ParkUI";
import {
  caption,
  item,
  row,
  selected,
  selectedCaption,
  sessions,
  time,
  unreadCaption,
} from "./itemStyles";
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
    handleSelect = useCallback(
      (event: MouseEvent<HTMLAnchorElement>) => {
        navigateLink(event, () => onSelect(session.id));
      },
      [onSelect, session.id],
    );
  return (
    <li className={cx("group", item, active && selected)}>
      <LinkButton
        aria-current={active ? "page" : undefined}
        aria-label={unread ? `${title}, ${t("sessionStoppedUnread")}` : title}
        className={row}
        href={pagePath({ id: session.id, kind: "session" })}
        onClick={handleSelect}
        title={`${title}${unread ? ` · ${t("sessionStoppedUnread")}` : ""}\n${session.workspace}`}
        variant="ghost"
      >
        <OverflowCaption
          className={cx(caption, active && selectedCaption, unread && unreadCaption)}
          text={title}
        />
        <Status compact error={session.error} status={session.status} />
        <RelativeTime className={time} locale={language} updatedAt={session.updatedAt} />
      </LinkButton>
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
