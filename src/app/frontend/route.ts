import { isEqual } from "es-toolkit";
import { type MouseEvent, startTransition, useCallback, useEffect, useRef, useState } from "react";

export function navigateLink(
  event: Pick<
    MouseEvent<HTMLAnchorElement>,
    "altKey" | "button" | "ctrlKey" | "defaultPrevented" | "metaKey" | "preventDefault" | "shiftKey"
  >,
  navigate: () => void,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  navigate();
}
export interface ForkPage {
  beforeMessageId: number;
  kind: "fork";
  sourceSessionId: string;
}
export type Page = ForkPage | { kind: "new" } | { kind: "session"; id: string };
const forkPrefix = "/fork/",
  sessionPrefix = "/sessions/";
function readPage(): Page {
  return pageFromHash(globalThis.location.hash);
}
function pageFromHash(hash: string): Page {
  const path = hash.startsWith("#") ? hash.slice(1) : hash;
  if (path === "/new") {
    return { kind: "new" };
  }
  if (path.startsWith(sessionPrefix)) {
    const id = decodeURIComponent(path.slice(sessionPrefix.length));
    if (id) {
      return { id, kind: "session" };
    }
  }
  if (path.startsWith(forkPrefix)) {
    const [source, messageId, extra] = path.slice(forkPrefix.length).split("/"),
      beforeMessageId = Number(messageId);
    if (
      source &&
      extra === undefined &&
      Number.isSafeInteger(beforeMessageId) &&
      beforeMessageId > 0
    ) {
      return {
        beforeMessageId,
        kind: "fork",
        sourceSessionId: decodeURIComponent(source),
      };
    }
  }
  return { kind: "new" };
}
export function pagePath(page: Page) {
  if (page.kind === "new") {
    return "#/new";
  }
  if (page.kind === "fork") {
    return `#/fork/${encodeURIComponent(page.sourceSessionId)}/${page.beforeMessageId.toString()}`;
  }
  return `#/sessions/${encodeURIComponent(page.id)}`;
}
function writePage(page: Page, replace = false) {
  const path = pagePath(page);
  if (globalThis.location.hash === path) {
    return;
  }
  const method = replace ? "replaceState" : "pushState";
  globalThis.history[method](null, "", path);
}
export function sessionPage(id: string): Page {
  return { id, kind: "session" };
}
export function forkPage(sourceSessionId: string, beforeMessageId: number): ForkPage {
  return { beforeMessageId, kind: "fork", sourceSessionId };
}
function pageSessionId(page: Page) {
  if (page.kind === "new") {
    return;
  }
  return page.kind === "session" ? page.id : page.sourceSessionId;
}
export function transcriptSessionId(
  sessionId: string | undefined,
  deletingSessionId: string | undefined,
) {
  return sessionId === deletingSessionId ? undefined : sessionId;
}
function resolvePage(page: Page, sessions: { id: string }[], ready: boolean) {
  if (!ready) {
    return page;
  }
  if (page.kind === "new") {
    return page;
  }
  const sessionId = pageSessionId(page);
  return sessions.some((session) => session.id === sessionId) ? page : ({ kind: "new" } as const);
}
export function usePageRouting(sessions: { id: string }[], ready: boolean) {
  "use no memo";
  const [requestedPage, setRequestedPage] = useState(readPage),
    revision = useRef<symbol>(undefined),
    page = resolvePage(requestedPage, sessions, ready),
    navigate = useCallback((nextPage: Page, replace: boolean | "history" = false) => {
      if (replace !== "history") {
        writePage(nextPage, replace);
      }
      revision.current = Symbol();
      startTransition(() => setRequestedPage(nextPage));
    }, []),
    selectSession = useCallback((id: string) => navigate(sessionPage(id)), [navigate]),
    captureNavigation = useCallback(() => {
      const currentRevision = revision.current,
        { hash } = globalThis.location;
      return () => revision.current === currentRevision && globalThis.location.hash === hash;
    }, []);
  useEffect(() => {
    const syncPage = () => navigate(readPage(), "history");
    globalThis.addEventListener("popstate", syncPage);
    return () => {
      globalThis.removeEventListener("popstate", syncPage);
    };
  }, [navigate]);
  useEffect(() => {
    if (requestedPage !== page && isEqual(readPage(), requestedPage)) {
      navigate(page, true);
    }
  }, [navigate, page, requestedPage]);
  return { captureNavigation, navigate, page, selectSession };
}
