import type { Context } from "hono";

import { ContentChannel } from "./events/contentChannel";
import type { BrowserWarning, SessionFailure, SyncPoint } from "./events/contracts";
import { StateChannel } from "./events/stateChannel";
import type { SessionInfo } from "./sessionState";
import type { DisplayEvent } from "./timeline";

export class AppEvents {
  private readonly content = new ContentChannel();
  private readonly state = new StateChannel();
  notifySession(session: SessionInfo) {
    this.state.notifySession(session);
  }
  notifyDeleted(sessionId: string) {
    this.state.notifyDeleted(sessionId);
  }
  notifyUserMessages() {
    this.state.notifyUserMessages();
  }
  notifyWarning(warning: BrowserWarning) {
    this.state.notifyWarning(warning);
  }
  notifyFailure(failure: SessionFailure) {
    this.state.notifyFailure(failure);
  }
  invalidateTranscript(sessionId: string, point: SyncPoint) {
    this.content.invalidate(sessionId, point);
  }
  notifyTranscript(sessionId: string, event: DisplayEvent) {
    this.content.notify(sessionId, event);
  }
  streamState(c: Context, getSessions: () => SessionInfo[]) {
    return this.state.stream(c, getSessions);
  }
  streamContent(c: Context, sessionId: string, point: SyncPoint) {
    return this.content.stream(c, sessionId, point);
  }
}
