import { Batcher } from "@tanstack/pacer/batcher";
import { z } from "zod";

import transcript from "#settings/runtime/transcript.yaml";

import type { TextStreamEventDraft } from "../../infrastructure/database/schema/streamEvent";
import type { HostContext } from "../context";

const { stream } = z
  .object({
    stream: z.object({
      batchSize: z.number().int().positive(),
      maxWaitMs: z.number().int().positive(),
    }),
  })
  .parse(transcript);
export class TextStreamWriter implements AsyncDisposable {
  private readonly batch: Batcher<TextStreamEventDraft>;
  private readonly failed = new AbortController();
  private firstQueuedAt = 0;
  private writing = Promise.resolve();
  readonly signal: AbortSignal;
  constructor({ db, sessionId }: Pick<HostContext, "db" | "sessionId">, signal: AbortSignal) {
    this.signal = AbortSignal.any([signal, this.failed.signal]);
    const write = async (drafts: TextStreamEventDraft[]) => {
      for (const event of coalesce(drafts)) {
        if (!this.signal.aborted) {
          await db.appendStream(sessionId, event);
        }
      }
    };
    this.batch = new Batcher(
      (drafts) => {
        this.writing = this.writing
          .then(() => write(drafts))
          .catch((error: unknown) => this.failed.abort(error));
      },
      {
        maxSize: stream.batchSize,
        wait: () => Math.max(0, this.firstQueuedAt + stream.maxWaitMs - performance.now()),
      },
    );
  }
  async add(event: TextStreamEventDraft) {
    if (!event.value || this.signal.aborted) {
      return;
    }
    if (this.batch.store.state.isEmpty) {
      this.firstQueuedAt = performance.now();
    }
    this.batch.addItem(event);
    await this.writing;
  }
  async flush() {
    this.batch.flush();
    await this.writing;
  }
  async [Symbol.asyncDispose]() {
    this.batch.cancel();
    await this.writing;
    this.failed.signal.throwIfAborted();
  }
}
function coalesce(drafts: TextStreamEventDraft[]) {
  const events: TextStreamEventDraft[] = [];
  for (const draft of drafts) {
    const last = events.at(-1);
    if (last?.partId === draft.partId && last.kind === draft.kind) {
      last.value += draft.value;
    } else {
      events.push({ ...draft });
    }
  }
  return events;
}
