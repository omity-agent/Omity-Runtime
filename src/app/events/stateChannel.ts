import { randomUUID } from "node:crypto";

import { isEqual } from "es-toolkit";
import type { Context } from "hono";
import mitt from "mitt";

import type { BrowserWarning, SessionFailure, SessionInfo } from "./contracts";
import { eventStream, type OutboundEvent } from "./stream";

export class StateChannel {
  private readonly bus = mitt<{ broadcast: OutboundEvent }>();
  private readonly epoch = randomUUID();
  private readonly published = new Map<string, SessionInfo>();
  private sequence = 0;
  notifySession(session: SessionInfo) {
    if (isEqual(this.published.get(session.id), session)) {
      return;
    }
    this.published.set(session.id, session);
    this.bus.emit("broadcast", this.version("session", session));
  }
  notifyDeleted(sessionId: string) {
    this.published.delete(sessionId);
    this.bus.emit("broadcast", this.version("deleted", { sessionId }));
  }
  notifyUserMessages() {
    this.bus.emit("broadcast", this.version("user-messages", {}));
  }
  notifyWarning(warning: BrowserWarning) {
    this.bus.emit("broadcast", this.version("warning", warning));
  }
  notifyFailure(failure: SessionFailure) {
    this.bus.emit("broadcast", this.version("failure", failure));
  }
  stream(c: Context, getSessions: () => SessionInfo[]) {
    return eventStream(c, (write) => {
      const event = c.req.header("Last-Event-ID") ? "sessions" : "restore",
        snapshot = this.version(event, { sessions: getSessions() });
      this.bus.on("broadcast", write);
      write(snapshot);
      return () => {
        this.bus.off("broadcast", write);
      };
    });
  }
  private version(event: string, data: unknown): OutboundEvent {
    this.sequence += 1;
    return { data, event, id: `${this.epoch}:${this.sequence.toString()}` };
  }
}
