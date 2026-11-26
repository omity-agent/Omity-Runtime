import { localize } from "../../../i18n/server";
import {
  selectSettingsProfiles,
  type SettingsContext,
} from "../../../infrastructure/configuration/settings/context";
import { Logger } from "../../../infrastructure/logging/logger";
import type { ToolboxOverrides } from "../../../infrastructure/mcp/configuration/selection";
import { AsyncResourceCache } from "../../../infrastructure/mcp/lifecycle";
import {
  type LoadedMcp,
  loadMcp,
  type LoadMcpOptions,
  loadSessionMcp,
} from "../../../infrastructure/mcp/tools/catalog";
import type { McpToolSnapshot } from "../../../infrastructure/mcp/tools/definitions";
import type { AskUserRuntime } from "../../../infrastructure/toolbox/runtime";
import type { LogLevel } from "../../../types";

export function createAppMcp(
  root: string,
  level: LogLevel,
  context: SettingsContext,
  askUser: AskUserRuntime,
) {
  const options: LoadMcpOptions = {
      askUser: (request, sessionId, signal) => askUser.ask(request, sessionId, signal),
    },
    sessionOptions = (cwd = root, overrides?: ToolboxOverrides): LoadMcpOptions => ({
      ...options,
      ...overrides,
      cwd,
    });
  return new AppMcp(
    (profiles, cwd, overrides) =>
      loadMcp(
        root,
        new Logger(level, true),
        selectSettingsProfiles(context, profiles),
        sessionOptions(cwd, overrides),
      ),
    (profiles, snapshot, cwd) =>
      loadSessionMcp(
        new Logger(level, true),
        selectSettingsProfiles(context, profiles),
        snapshot,
        sessionOptions(cwd),
      ),
  );
}
export class AppMcp {
  private readonly resources = new AsyncResourceCache<LoadedMcp>("App");
  constructor(
    private readonly initialize: (
      profiles: string[],
      cwd?: string,
      overrides?: ToolboxOverrides,
    ) => Promise<LoadedMcp>,
    private readonly initializeSnapshot: (
      profiles: string[],
      snapshot: McpToolSnapshot,
      cwd?: string,
    ) => Promise<LoadedMcp> = () =>
      Promise.reject(new Error(localize("application:resources.snapshotLoaderMissing"))),
  ) {}
  load(profiles: string[]) {
    return this.resources.load(JSON.stringify(profiles), () => this.initialize(profiles));
  }
  loadSession(sessionId: string, profiles: string[], snapshot: McpToolSnapshot, cwd: string) {
    return this.resources.load(`session:${sessionId}`, () =>
      this.initializeSnapshot(profiles, snapshot, cwd),
    );
  }
  createSession(sessionId: string, profiles: string[], cwd: string, overrides?: ToolboxOverrides) {
    const key = `session:${sessionId}`;
    if (this.resources.has(key)) {
      throw new Error(localize("application:resources.sessionAlreadyBound", { sessionId }));
    }
    return this.resources.load(key, () => this.initialize(profiles, cwd, overrides));
  }
  discardSession(sessionId: string) {
    return this.resources.discard(`session:${sessionId}`);
  }
  close() {
    return this.resources.close();
  }
}
