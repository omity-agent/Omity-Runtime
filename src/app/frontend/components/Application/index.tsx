import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PanelsTopLeft } from "lucide-react";
import { type ComponentProps, type ReactNode, useCallback, useEffect, useId } from "react";
import { useTranslation } from "react-i18next";

import type { SessionInfo } from "../../services/client";
import { useSessionAttention } from "../../services/events/attention";
import { Sidebar } from "../Sidebar";
import { statusLabelKey } from "../Sidebar/sessions";
import { IconButton } from "../ui";
import { usePanelNavigation } from "./navigation";
import { applicationShell } from "./shell";

type Props = Omit<ComponentProps<typeof Sidebar>, "activeId" | "unreadIds"> & {
  activeSession?: SessionInfo;
  children: ReactNode;
  pageKey: string;
  title?: string;
};
export function ApplicationFrame({
  activeSession,
  children,
  onCreate,
  onSelect,
  pageKey,
  sessions,
  showCreate,
  title,
}: Props) {
  const { t } = useTranslation(),
    queryClient = useQueryClient(),
    activeId = activeSession?.id,
    { buttonRef, showMain, showSessions, toggle } = usePanelNavigation(pageKey),
    classes = applicationShell({ panel: showSessions ? "sessions" : "main" }),
    sidebarId = useId(),
    unreadIds = useSessionAttention(queryClient, showSessions ? undefined : activeId),
    toggleLabel = t(showSessions ? "returnToMain" : "sessions"),
    create = useCallback(() => {
      showMain();
      onCreate();
    }, [onCreate, showMain]),
    select = useCallback(
      (id: string) => {
        showMain();
        onSelect(id);
      },
      [onSelect, showMain],
    );
  useEffect(() => {
    const brand = t("brand");
    document.title = activeSession
      ? `${t(statusLabelKey(activeSession.status))} · ${activeSession.title} · ${brand}`
      : brand;
    return () => {
      document.title = brand;
    };
  }, [activeSession, t]);
  return (
    <div className={classes.root} data-panel={showSessions ? "sessions" : "main"}>
      <header className={classes.toolbar}>
        <IconButton
          aria-controls={sidebarId}
          aria-expanded={showSessions}
          aria-label={toggleLabel}
          onClick={toggle}
          ref={buttonRef}
          title={toggleLabel}
          type="button"
        >
          {showSessions ? <ArrowLeft aria-hidden /> : <PanelsTopLeft aria-hidden />}
        </IconButton>
        <span className={classes.caption} title={title}>
          {showSessions ? t("sessions") : (title ?? t("newSession"))}
        </span>
      </header>
      <aside className={classes.sidebar} id={sidebarId}>
        <Sidebar
          activeId={activeId}
          showCreate={showCreate}
          sessions={sessions}
          unreadIds={unreadIds}
          onCreate={create}
          onSelect={select}
        />
      </aside>
      <main className={classes.main}>{children}</main>
    </div>
  );
}
