import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CodeXml, PanelsTopLeft, Plus } from "lucide-react";
import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";

import { useTranslation } from "../../i18n";
import { navigateLink, pagePath } from "../../route";
import type { SessionInfo } from "../../services/client";
import { useSessionAttention } from "../../services/events/attention";
import { CredentialAction } from "../Access/CredentialAction";
import { MarkdownSourceContext } from "../Markdown/Source";
import { Sidebar } from "../Sidebar";
import { statusLabelKey } from "../Sidebar/sessions";
import { IconButton, LinkButton } from "../ui";
import { usePanelNavigation } from "./navigation";
import { applicationShell } from "./shell";

type Props = Omit<ComponentProps<typeof Sidebar>, "activeId" | "unreadIds"> & {
  activeSession?: SessionInfo;
  children: ReactNode;
  createDisabled: boolean;
  onCreate: () => void;
  pageKey: string;
  title?: string;
};
export function ApplicationFrame({
  activeSession,
  children,
  createDisabled,
  onCreate,
  onSelect,
  pageKey,
  sessions,
  title,
}: Props) {
  const { t } = useTranslation(),
    queryClient = useQueryClient(),
    activeId = activeSession?.id,
    { buttonRef, showMain, showSessions, toggle } = usePanelNavigation(pageKey),
    classes = applicationShell({ panel: showSessions ? "sessions" : "main" }),
    sidebarId = useId(),
    [showSource, setShowSource] = useState(false),
    unreadIds = useSessionAttention(queryClient, showSessions ? undefined : activeId),
    sourceLabel = t("shell:markdownSource"),
    toggleLabel = t(showSessions ? "shell:returnToMain" : "shell:sessions"),
    toggleSource = useCallback(() => setShowSource((enabled) => !enabled), [setShowSource]),
    create = useCallback(
      (event: MouseEvent<HTMLAnchorElement>) => {
        navigateLink(event, () => {
          showMain();
          onCreate();
        });
      },
      [onCreate, showMain],
    ),
    select = useCallback(
      (id: string) => {
        showMain();
        onSelect(id);
      },
      [onSelect, showMain],
    );
  useEffect(() => {
    const brand = t("shell:brand");
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
          className={classes.panelToggle}
          onClick={toggle}
          ref={buttonRef}
          title={toggleLabel}
          visual="ghost"
        >
          {showSessions ? <ArrowLeft aria-hidden /> : <PanelsTopLeft aria-hidden />}
        </IconButton>
        <LinkButton
          aria-disabled={createDisabled || undefined}
          aria-label={t("shell:newSession")}
          data-disabled={createDisabled ? "" : undefined}
          href={createDisabled ? undefined : pagePath({ kind: "new" })}
          iconOnly
          onClick={createDisabled ? undefined : create}
          role={createDisabled ? "link" : undefined}
          title={t("shell:newSession")}
          visual="ghost"
        >
          <Plus aria-hidden size={16} />
        </LinkButton>
        <IconButton
          aria-label={sourceLabel}
          aria-pressed={showSource}
          onClick={toggleSource}
          title={sourceLabel}
          visual={showSource ? "outline" : "ghost"}
        >
          <CodeXml aria-hidden size={16} />
        </IconButton>
        <CredentialAction />
        <span className={classes.caption} title={title}>
          {showSessions ? t("shell:sessions") : (title ?? t("shell:newSession"))}
        </span>
      </header>
      <aside className={classes.sidebar} id={sidebarId}>
        <Sidebar activeId={activeId} sessions={sessions} unreadIds={unreadIds} onSelect={select} />
      </aside>
      <main className={classes.main}>
        <MarkdownSourceContext value={showSource}>{children}</MarkdownSourceContext>
      </main>
    </div>
  );
}
