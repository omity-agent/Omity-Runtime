import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { hasErrorCode } from "../../failures/thrownValues";
import { localize } from "../../i18n/server";

export class AppInstanceLock implements Disposable {
  private released = false;
  private constructor(private readonly db: Database) {}
  static acquire(directory: string) {
    mkdirSync(directory, { recursive: true });
    const path = resolve(directory, "app.lock"),
      db = new Database(path, { create: true, strict: true });
    try {
      db.run("BEGIN EXCLUSIVE");
      return new AppInstanceLock(db);
    } catch (error) {
      db.close(true);
      throw new Error(
        hasErrorCode(error, "SQLITE_BUSY")
          ? localize("application:runtime.instanceAlreadyRunning", { directory })
          : localize("application:runtime.lockAcquireFailed", { path }),
        { cause: error },
      );
    }
  }
  release() {
    if (!this.released) {
      this.db.close(true);
      this.released = true;
    }
  }
  [Symbol.dispose]() {
    this.release();
  }
}
