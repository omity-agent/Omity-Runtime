import type { SettingsContext } from "../infrastructure/configuration/settings/context";
import type { AgentDatabase } from "../infrastructure/database/agentDatabase";
import type { AskUserRuntime } from "../infrastructure/toolbox/runtime";
import type { AppSettings, BrowserWarning } from "../types";
import type { AppEvents } from "./events";
import { type AppHostEvents, AppHosts } from "./hosts";
import type { RegisteredSession } from "./registry";
import { createAppMcp } from "./runtime/resources/toolPool";
import { projectSession, type SessionInfo } from "./sessionState";

function controllerHostEvents(
  events: AppEvents,
  sessionInfo: (sessionId: string) => SessionInfo,
  changed: (sessionId: string) => void,
  prediction: (sessionId: string) => void,
): AppHostEvents {
  return {
    activity: (sessionId, activity) => {
      if (activity === "idle") {
        prediction(sessionId);
      }
      events.notifySession(sessionInfo(sessionId));
    },
    changed,
    failure: (sessionId, error) => {
      events.notifyFailure({ error, sessionId });
    },
    warning: (sessionId, warning: BrowserWarning) => {
      events.notifyWarning({ ...warning, details: { ...warning.details, sessionId } });
    },
  };
}
export function createControllerHosts(options: {
  askUser: AskUserRuntime;
  changed: (sessionId: string) => void;
  context: SettingsContext;
  database: AgentDatabase;
  events: AppEvents;
  prediction: (sessionId: string) => void;
  root: string;
  sessionInfo: (sessionId: string) => SessionInfo;
  settings: AppSettings;
}) {
  const { askUser, changed, context, database, events, prediction, root, sessionInfo, settings } =
    options;
  return new AppHosts(
    controllerHostEvents(events, sessionInfo, changed, prediction),
    database,
    settings.host.shutdownTimeoutMs,
    createAppMcp(root, settings.logging.level, context, askUser),
    context,
  );
}
export function controllerSessionInfo(
  session: RegisteredSession,
  hosts: AppHosts,
  askUser: AskUserRuntime,
) {
  return projectSession(
    session,
    hosts.activity(session.id),
    hosts.error(session.id),
    askUser.question(session.id),
  );
}
