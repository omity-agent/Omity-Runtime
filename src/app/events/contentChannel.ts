import type { Context } from "hono";
import mitt from "mitt";

import type { DisplayEvent } from "../timeline";
import type { SyncPoint } from "./contracts";
import { eventStream, type OutboundEvent } from "./stream";

export class ContentChannel {
  private readonly bus = mitt<Record<`session:${string}`, OutboundEvent>>();
  notify(sessionId: string, event: DisplayEvent) {
    this.bus.emit(`session:${sessionId}`, {
      data: event,
      event: "delta",
      id: event.id.toString(),
    });
  }
  invalidate(sessionId: string, point: SyncPoint) {
    this.bus.emit(`session:${sessionId}`, contentSync(point));
  }
  stream(c: Context, sessionId: string, point: SyncPoint) {
    return eventStream(c, (write) => {
      const key = `session:${sessionId}` as const,
        snapshot = contentSync(point);
      this.bus.on(key, write);
      write(snapshot);
      return () => {
        this.bus.off(key, write);
        if (this.bus.all.get(key)?.length === 0) {
          this.bus.all.delete(key);
        }
      };
    });
  }
}
function contentSync(point: SyncPoint): OutboundEvent {
  return {
    data: point,
    event: "sync",
    id: point.eventCursor.toString(),
  };
}
