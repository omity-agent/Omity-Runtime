import { randomUUID } from "node:crypto";

import { z } from "zod";

import transcript from "#settings/runtime/transcript.yaml";

import type { AppRegistry } from "./registry";
import { loadTranscript } from "./transcript";

const { retainedHistoryChanges } = z
  .object({
    retainedHistoryChanges: z.number().int().positive(),
  })
  .parse(transcript);

interface HistoryChange {
  token: string;
  position: number;
}
interface SessionHistory {
  changes: HistoryChange[];
  token: string;
}
export class TranscriptFeed {
  private readonly history = new Map<string, SessionHistory>();
  constructor(private readonly registry: AppRegistry) {}
  read(sessionId: string, clientToken?: string) {
    return this.registry.read(sessionId, (db) => {
      const current = this.history.getOrInsertComputed(sessionId, () => ({
        changes: [],
        token: randomUUID(),
      }));
      return loadTranscript(db, sessionId, {
        position: firstChangedPosition(current, clientToken),
        token: current.token,
      });
    });
  }
  syncPoint(sessionId: string) {
    return {
      eventCursor: this.registry.eventCursor(sessionId),
      transcriptRevision: this.registry.require(sessionId).transcriptRevision,
    };
  }
  reviseHistory(sessionId: string, position: number) {
    const current = this.history.get(sessionId);
    if (current) {
      current.changes.push({ position, token: current.token });
      if (current.changes.length > retainedHistoryChanges) {
        current.changes.shift();
      }
      current.token = randomUUID();
    }
  }
  forgetHistory(sessionId: string) {
    this.history.delete(sessionId);
  }
}
function firstChangedPosition(current: SessionHistory, clientToken?: string) {
  if (clientToken === current.token) {
    return null;
  }
  const since = current.changes.findIndex(({ token }) => token === clientToken);
  return since < 0 ? 0 : Math.min(...current.changes.slice(since).map(({ position }) => position));
}
