import { requestControlRecord } from "./infrastructure/database/records/execution/control";
import { openStoredSession } from "./storedSessions";
import type { ControlCommand } from "./types";

export function appendSessionMessage(sessionId: string, content: string) {
  using db = openStoredSession(sessionId);
  return { inputId: db.appendUser(sessionId, content) };
}
export function submitSessionMessage(
  sessionId: string,
  content: string,
  draftRevision: number,
  submissionId: string,
) {
  using db = openStoredSession(sessionId);
  return { inputId: db.submitUser(sessionId, content, draftRevision, submissionId) };
}
export function setSessionControl(sessionId: string, control: ControlCommand) {
  using db = openStoredSession(sessionId);
  requestControlRecord(db.db, sessionId, control);
  return { control };
}
