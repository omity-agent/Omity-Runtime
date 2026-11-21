import type { ErrorDetails } from "../failures/details";
import type { AskUserRequest } from "../infrastructure/toolbox/askUser";
import type { HostActivity, SessionStatus } from "../types";
import type { SessionInfo } from "./events/contracts";
import type { RegisteredSession } from "./registry";

export type { SessionInfo } from "./events/contracts";
export function projectSession(
  session: RegisteredSession,
  activity: HostActivity,
  hostError: ErrorDetails | null,
  askUser: AskUserRequest | null = null,
): SessionInfo {
  const error = hostError ?? session.error,
    { control, runStatus } = session;
  return {
    askUser,
    createdAt: session.createdAt,
    error,
    id: session.id,
    profile: session.profiles.at(-1),
    status: resolveSessionStatus(session, activity, error),
    stepAvailable: runStatus === "paused" && (control === "running" || control === "pause"),
    title: session.title,
    updatedAt: session.updatedAt,
    workspace: session.workspace,
  };
}
function resolveSessionStatus(
  { control, runStatus }: Pick<RegisteredSession, "control" | "runStatus">,
  activity: HostActivity,
  error: ErrorDetails | null,
): SessionStatus {
  if (control === "step" && runStatus !== null) {
    return "stepping";
  }
  if (error) {
    return "error";
  }
  if (control === "pause" || control === "pause_cancel") {
    return runStatus === "running" ? "pausing" : "paused";
  }
  if (runStatus === "paused") {
    return "paused";
  }
  if (runStatus === null) {
    return "idle";
  }
  return runStatus === "pending" || activity === "idle" ? "waiting" : activity;
}
