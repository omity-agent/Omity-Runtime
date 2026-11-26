import { buildGraph } from "../../agent";
import type { ToolExecutions } from "../../agent/toolExecutions";
import { HookRuntime } from "../../hooks/runtime";
import { localize } from "../../i18n/server";
import { resolveSessionPaths } from "../../infrastructure/configuration/sessionPaths";
import {
  selectSettingsProfiles,
  type SettingsContext,
} from "../../infrastructure/configuration/settings/context";
import { loadSettings } from "../../infrastructure/configuration/settings/load";
import { normalizeWorkspacePath } from "../../infrastructure/configuration/workspacePath";
import { readDefinitionRecord } from "../../infrastructure/database/records/session/metadata";
import { applySessionDefinition } from "../../infrastructure/database/session/sessionDefinition";
import { Logger } from "../../infrastructure/logging/logger";
import { fetchLatestCodexVersion } from "../../infrastructure/openai/codexVersion";
import type { HostContext } from "../../runtime/context";
import { hostLoop } from "../../runtime/loop";
import type { AppMcp } from "../runtime/resources/toolPool";
import type { RunningHost } from "./observation";

export async function runSessionHost({
  db,
  mcp,
  ready,
  sessionId,
  settingsContext,
  toolExecutions,
  workspace,
  ...runtime
}: Pick<
  HostContext,
  "controller" | "db" | "notifications" | "observer" | "sessionId" | "stopping"
> & {
  mcp: AppMcp;
  ready: () => void;
  settingsContext: SettingsContext;
  toolExecutions: ToolExecutions;
  workspace: string;
}) {
  const { cwd, definition, profiles, settings } = loadSessionRuntime(
      db,
      sessionId,
      workspace,
      settingsContext,
    ),
    codexVersion = settings.model.adapter === "codex" ? await fetchLatestCodexVersion() : undefined,
    loadedTools = await mcp.loadSession(sessionId, profiles, definition.prefix.tools, cwd),
    { dir: session } = resolveSessionPaths(sessionId),
    logger = new Logger(settings.logging.level),
    tools = loadedTools.modelTools({ cwd, session }),
    hooks = new HookRuntime(
      settings.hooks,
      tools,
      db.db,
      logger,
      sessionId,
      cwd,
      loadedTools.freeformToolParameters,
      session,
    ),
    graph = buildGraph(settings, tools, definition.prefix.tools.tools, db.db, hooks, {
      codexVersion,
      toolExecutions,
    });
  runtime.controller.signal.throwIfAborted();
  ready();
  await hostLoop({ ...runtime, db, graph, logger, sessionId, settings });
}
export function loadSessionRuntime(
  db: HostContext["db"],
  sessionId: string,
  workspace: string,
  baseContext: SettingsContext,
) {
  const { root } = baseContext,
    cwd = normalizeWorkspacePath(workspace, root),
    profiles = db.profiles(sessionId),
    definition = readDefinitionRecord(db.db, sessionId),
    settingsContext = selectSettingsProfiles(baseContext, profiles),
    settings = applySessionDefinition(
      loadSettings(root, { cwd, sessionId, settingsContext }),
      definition,
    );
  return { cwd, definition, profiles, settings };
}
export async function stopAtRecoveryBoundary({ done, force }: RunningHost, timeoutMs: number) {
  const deadline = Promise.withResolvers<false>(),
    timer = setTimeout(() => deadline.resolve(false), timeoutMs);
  try {
    const stopped = await Promise.race([done.then(() => true), deadline.promise]);
    if (!stopped) {
      force.abort(new Error(localize("application:hosts.recoveryBoundaryTimeout")));
    }
    await done;
  } finally {
    clearTimeout(timer);
  }
}
