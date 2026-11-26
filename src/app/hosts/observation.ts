import type { ToolExecutions } from "../../agent/toolExecutions";
import type { ErrorDetails } from "../../failures/details";
import type { HostObserver } from "../../runtime/context";
import type { HostNotifications } from "../../runtime/execution/notifications";
import type { BrowserWarning, HostActivity } from "../../types";

export interface RunningHost {
  activity: HostActivity;
  done: Promise<void>;
  executions: ToolExecutions;
  force: AbortController;
  notifications: HostNotifications;
  ready: Promise<void>;
  stopping: AbortController;
}
export interface AppHostEvents {
  activity: (sessionId: string, activity: HostActivity) => void;
  changed: (sessionId: string) => void;
  failure: (sessionId: string, error: ErrorDetails) => void;
  warning: (sessionId: string, warning: BrowserWarning) => void;
}
export function createHostObserver(
  events: AppHostEvents,
  running: Map<string, RunningHost>,
  force: AbortController,
): HostObserver {
  return {
    activity: (sessionId, activity) => {
      const host = running.get(sessionId);
      if (host?.force !== force || host.activity === activity) {
        return;
      }
      host.activity = activity;
      events.activity(sessionId, activity);
    },
    changed: (sessionId) => {
      events.changed(sessionId);
    },
    failure: (sessionId, error) => {
      events.failure(sessionId, error);
    },
    warning: (sessionId, warning) => {
      events.warning(sessionId, warning);
    },
  };
}
