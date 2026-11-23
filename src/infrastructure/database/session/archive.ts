import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { hasErrorCode } from "../../../failures/thrownValues";

export class UserMessageArchive {
  constructor(private readonly directory: string) {}
  append(content: string) {
    mkdirSync(this.directory, { recursive: true });
    const occupied = new Set(readdirSync(this.directory));
    for (let id = 0; ; id += 1) {
      if (!occupied.has(`${id.toString()}.txt`)) {
        const path = this.path(id);
        try {
          writeFileSync(path, content, { encoding: "utf8", flag: "wx" });
          return path;
        } catch (error) {
          if (!hasErrorCode(error, "EEXIST")) {
            throw error;
          }
        }
      }
    }
  }
  writeAll(contents: readonly string[]) {
    mkdirSync(this.directory, { recursive: true });
    using rollback = new DisposableStack();
    for (const [id, content] of contents.entries()) {
      const path = this.path(id);
      writeFileSync(path, content, { encoding: "utf8", flag: "wx" });
      rollback.defer(() => this.remove(path));
    }
    rollback.move();
  }
  remove(path: string) {
    rmSync(path, { force: true });
  }
  private path(id: number) {
    return resolve(this.directory, `${id.toString()}.txt`);
  }
}
