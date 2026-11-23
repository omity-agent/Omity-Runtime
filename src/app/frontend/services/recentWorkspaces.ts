import type { SessionInfo } from "./client";

const recentWorkspaceLimit = 8;
export function recentWorkspaces(sessions: SessionInfo[]) {
  return [...new Set(sessions.map(({ workspace }) => workspace))].slice(0, recentWorkspaceLimit);
}
