import { once } from "node:events";

import { localize } from "../../i18n/server";
import type { ControlCommand } from "../../types";

export class HostNotifications {
  private readonly changes = new EventTarget();
  private sequence = {};
  private operation?: AbortController;
  checkpoint() {
    return this.sequence;
  }
  notify(command?: ControlCommand) {
    this.sequence = {};
    if (command === "force_pause") {
      this.operation?.abort(new Error(localize("runtime:pause.forced")));
    }
    this.changes.dispatchEvent(new Event("change"));
  }
  async wait(checkpoint: object, signal: AbortSignal) {
    if (signal.aborted || checkpoint !== this.sequence) {
      return;
    }
    try {
      await once(this.changes, "change", { signal });
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }
  startOperation(parent: AbortSignal) {
    const operation = new AbortController();
    this.operation = operation;
    return {
      interrupted: () => operation.signal.aborted,
      signal: AbortSignal.any([parent, operation.signal]),
      [Symbol.dispose]: () => {
        this.operation = undefined;
      },
    };
  }
}
