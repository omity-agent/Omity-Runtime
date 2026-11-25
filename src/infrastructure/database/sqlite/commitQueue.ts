import type { Database } from "bun:sqlite";

import { runTransaction } from "./connection";

interface CommitRequest extends PromiseWithResolvers<void> {
  write: () => void;
}
export class CommitQueue {
  private pending: CommitRequest[] = [];
  private scheduled?: ReturnType<typeof setImmediate>;
  constructor(private readonly db: Database) {}
  enqueue(write: () => void) {
    const result = this.add(write);
    this.scheduled ??= setImmediate(() => this.flush());
    return result;
  }
  commit(write: () => void) {
    const result = this.add(write);
    this.flush();
    return result;
  }
  flush() {
    if (this.scheduled) {
      clearImmediate(this.scheduled);
      this.scheduled = undefined;
    }
    const requests = this.pending;
    this.pending = [];
    const [first] = requests;
    if (!first) {
      return;
    }
    try {
      if (requests.length === 1) {
        runTransaction(this.db, first.write);
        first.resolve();
        return;
      }
      const written = runTransaction(this.db, () =>
        requests.filter((request) => {
          try {
            runTransaction(this.db, request.write);
            return true;
          } catch (error) {
            request.reject(error);
            return false;
          }
        }),
      );
      for (const request of written) {
        request.resolve();
      }
    } catch (error) {
      for (const request of requests) {
        request.reject(error);
      }
    }
  }
  private add(write: () => void) {
    const result = Promise.withResolvers<void>();
    this.pending.push({ ...result, write });
    return result.promise;
  }
}
