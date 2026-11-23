import type { Database } from "bun:sqlite";

import { resolveSessionPaths } from "../../../configuration/sessionPaths";
import { UserMessageArchive } from "../../session/archive";
import { runTransaction } from "../../sqlite/connection";
import { clearComposerDraftRecord } from "../session/composerDrafts";
import { requireSessionRecord, touchSessionRecord } from "../session/metadata";
import { enqueueInputRecord } from "./queue/admission";

export class InputSubmissionStore {
  constructor(private readonly db: Database) {}
  appendUser(sessionId: string, content: string) {
    return this.accept(sessionId, content);
  }
  submitUser(sessionId: string, content: string, draftRevision: number, submissionId: string) {
    return this.accept(sessionId, content, { draftRevision, submissionId });
  }
  private accept(
    sessionId: string,
    content: string,
    submission?: { draftRevision: number; submissionId: string },
  ) {
    using rollback = new DisposableStack();
    const inputId = runTransaction(
      this.db,
      () => {
        requireSessionRecord(this.db, sessionId);
        const id = enqueueInputRecord(this.db, sessionId, content, submission?.submissionId);
        if (submission) {
          clearComposerDraftRecord(this.db, sessionId, submission.draftRevision);
        }
        const archive = new UserMessageArchive(resolveSessionPaths(sessionId).userMessagesDir),
          saved = archive.append(content);
        rollback.defer(() => archive.remove(saved));
        touchSessionRecord(this.db, sessionId);
        return id;
      },
      "immediate",
    );
    rollback.move();
    return inputId;
  }
}
