import { Debouncer } from "@tanstack/pacer";

import { type ComposerDraftTarget, writeComposerDraft } from "../composerDrafts";

interface DraftSnapshot {
  content: string;
  revision: number;
}
type PersistDraft = (
  target: ComposerDraftTarget,
  content: string,
  revision: number,
) => Promise<unknown>;
export class DraftSaver {
  private readonly debouncer: Debouncer<(snapshot: DraftSnapshot) => void>;
  private tail: Promise<void> = Promise.resolve();
  private latest: Promise<void> = this.tail;
  constructor(
    private readonly target: ComposerDraftTarget,
    delayMs: number,
    private readonly onError: (error: unknown) => void,
    private readonly persist: PersistDraft = writeComposerDraft,
  ) {
    this.debouncer = new Debouncer(
      (snapshot) => {
        this.latest = this.persistAfter(this.tail, snapshot);
        this.tail = this.observe(this.latest);
      },
      { wait: delayMs },
    );
  }
  schedule(content: string, revision: number) {
    this.debouncer.maybeExecute({ content, revision });
  }
  discardPending() {
    this.debouncer.cancel();
  }
  async flush() {
    this.debouncer.flush();
    await this.latest;
  }
  private async persistAfter(previous: Promise<void>, snapshot: DraftSnapshot) {
    await previous;
    await this.persist(this.target, snapshot.content, snapshot.revision);
  }
  private async observe(pending: Promise<void>) {
    try {
      await pending;
    } catch (error) {
      this.onError(error);
    }
  }
}
