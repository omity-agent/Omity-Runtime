import { maxBy } from "es-toolkit";

import { isRunningStatus, type SessionStatus } from "../../../../types";
import { uiBehavior } from "../../presentation/preferences";
import type { SessionInfo } from "../../services/client";

const dayMs = 86_400_000,
  hourMs = 3_600_000,
  minuteMs = 60_000,
  weekMs = 604_800_000;
export interface WorkspaceGroup {
  workspace: string;
  sessions: SessionInfo[];
  runningCount: number;
  createdAt: number;
  updatedAt: number;
}
function isRunning(session: SessionInfo) {
  return isRunningStatus(session.status);
}
export function statusLabelKey(status: SessionStatus) {
  const labels = {
    error: "shell:status.error",
    idle: "shell:status.idle",
    paused: "shell:status.paused",
    pausing: "shell:status.pausing",
    stepping: "conversation:stepping",
    streaming: "shell:status.streaming",
    tool: "shell:status.tool",
    waiting: "shell:status.waiting",
  } as const;
  return labels[status];
}
export function groupSessions(sessions: SessionInfo[]): WorkspaceGroup[] {
  return [...Map.groupBy(sessions, (session) => session.workspace)]
    .map(toGroup)
    .toSorted(compareGroups);
}
export function recentSessions(sessions: SessionInfo[], unreadIds: ReadonlySet<string>) {
  const needsAttention = (session: SessionInfo) => isRunning(session) || unreadIds.has(session.id);
  return sessions
    .toSorted(
      (left, right) =>
        Number(needsAttention(right)) - Number(needsAttention(left)) ||
        compareSessions(left, right),
    )
    .slice(0, uiBehavior.recentSessions);
}
export function workspaceLabel(workspace: string) {
  const parts = workspace.split(/[\\/]+/u).filter(Boolean);
  return parts.at(-1) ?? workspace;
}
export function formatUpdatedAt(updatedAt: number, locale: string, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor(now / 1000) - updatedAt),
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (elapsedSeconds < 60) {
    return formatter.format(0, "second");
  }
  if (elapsedSeconds < 3600) {
    return formatter.format(-Math.floor(elapsedSeconds / 60), "minute");
  }
  if (elapsedSeconds < 86_400) {
    return formatter.format(-Math.floor(elapsedSeconds / 3600), "hour");
  }
  if (elapsedSeconds < 604_800) {
    return formatter.format(-Math.floor(elapsedSeconds / 86_400), "day");
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
  }).format(updatedAt * 1000);
}
export function updatedAtRefreshDelay(updatedAt: number, now = Date.now()) {
  const elapsedMs = Math.max(0, now - updatedAt * 1000);
  if (elapsedMs < minuteMs) {
    return minuteMs - elapsedMs;
  }
  if (elapsedMs < hourMs) {
    return minuteMs - (elapsedMs % minuteMs);
  }
  if (elapsedMs < dayMs) {
    return hourMs - (elapsedMs % hourMs);
  }
  if (elapsedMs < weekMs) {
    return dayMs - (elapsedMs % dayMs);
  }
  return undefined;
}
function toGroup([workspace, source]: [string, SessionInfo[]]): WorkspaceGroup {
  const sessions = [...source].toSorted(compareSessions);
  return {
    createdAt: maxBy(sessions, (session) => session.createdAt)!.createdAt,
    runningCount: sessions.filter(isRunning).length,
    sessions,
    updatedAt: maxBy(sessions, (session) => session.updatedAt)!.updatedAt,
    workspace,
  };
}
function compareSessions(left: SessionInfo, right: SessionInfo) {
  const runningOrder = Number(isRunning(right)) - Number(isRunning(left));
  if (runningOrder !== 0) {
    return runningOrder;
  }
  if (isRunning(left)) {
    return right.createdAt - left.createdAt || left.id.localeCompare(right.id);
  }
  return (
    right.updatedAt - left.updatedAt ||
    right.createdAt - left.createdAt ||
    left.id.localeCompare(right.id)
  );
}
function compareGroups(left: WorkspaceGroup, right: WorkspaceGroup) {
  const runningOrder = Number(right.runningCount > 0) - Number(left.runningCount > 0);
  if (runningOrder !== 0) {
    return runningOrder;
  }
  const recencyOrder =
    left.runningCount > 0 ? right.createdAt - left.createdAt : right.updatedAt - left.updatedAt;
  return recencyOrder || left.workspace.localeCompare(right.workspace);
}
