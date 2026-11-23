import { uiBehavior } from "../presentation/preferences";
import type { SessionInfo } from "./client";

export function recentWorkspaces(sessions: SessionInfo[]) {
  return [...new Set(sessions.map(({ workspace }) => workspace))].slice(
    0,
    uiBehavior.recentWorkspaces,
  );
}
