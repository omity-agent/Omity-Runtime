import { localize } from "../i18n/server";
import { DomainError } from "./domain";

export function sessionNotFound(sessionId: string) {
  return new DomainError("SESSION_NOT_FOUND", localize("errors:session.notFound", { sessionId }));
}
export function sessionConflict(sessionId: string) {
  return new DomainError(
    "SESSION_CONFLICT",
    localize("errors:session.alreadyExists", { sessionId }),
  );
}
export function sessionProfileBusy(sessionId: string) {
  return new DomainError(
    "SESSION_PROFILE_BUSY",
    localize("errors:session.profileBusy", { sessionId }),
  );
}
export function toolNotRunning(callId: string) {
  return new DomainError("TOOL_NOT_RUNNING", localize("errors:tool.notRunning", { callId }));
}
export function askUserAnswerInvalid(message: string) {
  return new DomainError("ASK_USER_ANSWER_INVALID", message);
}
export function controlNotReady(control: string) {
  return new DomainError("CONTROL_NOT_READY", localize("errors:control.notReady", { control }));
}
