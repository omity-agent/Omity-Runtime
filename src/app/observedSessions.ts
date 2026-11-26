import type { AgentDatabase } from "../infrastructure/database/agentDatabase";
import {
  type ReasoningTranslation,
  storeReasoningTranslation,
} from "../infrastructure/database/records/transcript/reasoningTranslations";
import { TranscriptFeed } from "./contentFeed";
import type { AppEvents } from "./events";
import type { AppRegistry, RegisteredSession } from "./registry";
import type { SessionInfo } from "./sessionState";
import { UserMessageHistory } from "./userMessages";

export class ObservedSessions {
  readonly transcript: TranscriptFeed;
  readonly userMessages: UserMessageHistory;
  constructor(
    db: AgentDatabase,
    private readonly registry: AppRegistry,
    private readonly events: AppEvents,
    private readonly project: (session: RegisteredSession) => SessionInfo,
  ) {
    this.transcript = new TranscriptFeed(registry);
    this.userMessages = new UserMessageHistory(db.db);
    db.observe({
      history: (id, position, userMessagesChanged) => {
        this.transcript.reviseHistory(id, position);
        if (userMessagesChanged) {
          this.publishUserMessages();
        }
      },
      stream: (id, event) => {
        this.events.notifyTranscript(id, event);
        if (event.kind === "user_appended") {
          this.refresh(id);
        }
      },
    });
  }
  add(id: string, userMessagesChanged: boolean) {
    const session = this.registry.refresh(id);
    if (userMessagesChanged) {
      this.publishUserMessages();
    }
    return this.publish(session);
  }
  remove(id: string) {
    this.registry.remove(id);
    this.transcript.forgetHistory(id);
    this.events.notifyDeleted(id);
    this.publishUserMessages();
  }
  refresh(id: string) {
    const previous = this.registry.require(id),
      current = this.registry.refresh(id);
    if (current.transcriptRevision !== previous.transcriptRevision) {
      this.events.invalidateTranscript(id, this.transcript.syncPoint(id));
    }
    return this.publish(current);
  }
  publishActivity(id: string) {
    this.publish(this.registry.require(id));
  }
  saveTranslation(id: string, translation: ReasoningTranslation) {
    this.registry.read(id, (db) => storeReasoningTranslation(db, id, translation));
    this.refresh(id);
    return translation;
  }
  private publish(session: RegisteredSession) {
    const info = this.project(session);
    this.events.notifySession(info);
    return info;
  }
  private publishUserMessages() {
    this.userMessages.invalidate();
    this.events.notifyUserMessages();
  }
}
