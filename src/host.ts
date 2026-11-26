import { buildGraph } from "./agent";
import { ToolExecutions } from "./agent/toolExecutions";
import { HookRuntime } from "./hooks/runtime";
import { localize } from "./i18n/server";
import { createSessionDefinition } from "./infrastructure/database/session/sessionDefinition";
import { removeDatabaseDirectory } from "./infrastructure/database/sqlite/connection";
import { Logger } from "./infrastructure/logging/logger";
import { loadMcp, loadSessionMcp } from "./infrastructure/mcp/tools/catalog";
import { fetchLatestCodexVersion } from "./infrastructure/openai/codexVersion";
import type { HostRunOptions } from "./runtime/execution/hostOptions";
import { HostLease } from "./runtime/execution/lease";
import { prepareHostSession } from "./runtime/execution/sessionPreparation";
import { wireHostSignals } from "./runtime/execution/signals";
import { hostLoop } from "./runtime/loop";
import type { HostMode } from "./types";

export async function runHost(mode: HostMode, root = process.cwd(), options: HostRunOptions = {}) {
  await runHostSession(mode, root, {
    ...options,
    recoverInterrupted: options.recoverInterrupted ?? mode.kind === "load",
    wireSigint: options.wireSigint ?? true,
  });
}
export async function runHostSession(
  mode: HostMode,
  root = process.cwd(),
  options: HostRunOptions = {},
) {
  await using resources = new AsyncDisposableStack();
  const {
    db,
    definition,
    paths,
    profiles,
    settings: loadedSettings,
    settingsContext,
    workspace,
  } = prepareHostSession(mode, root, options);
  let sessionCreated = definition !== undefined;
  resources.defer(() => {
    if (!sessionCreated && mode.kind !== "load") {
      removeDatabaseDirectory(paths.dir);
    }
  });
  resources.defer(() => db.close());
  const settings = options.quiet
      ? {
          ...loadedSettings,
          logging: { ...loadedSettings.logging, streamTokens: false },
        }
      : loadedSettings,
    logger = new Logger(settings.logging.level, options.quiet ?? false),
    controller = options.controller ?? new AbortController(),
    stoppingController = options.stoppingController ?? new AbortController(),
    toolExecutions = new ToolExecutions({
      cancellationRequested: (callId) => db.toolCancellation(mode.sessionId, callId),
      pollMs: settings.host.pollMs,
    });
  let codexVersion: string | undefined,
    lease: HostLease | undefined,
    ownedMcp: Awaited<ReturnType<typeof loadMcp>> | undefined;
  resources.defer(() => lease?.close());
  resources.defer(async () => {
    await ownedMcp?.close();
  });
  const unwireSignals = wireHostSignals({
    enabled: options.wireSigint ?? false,
    force: controller,
    logger,
    stopping: stoppingController,
    timeoutMs: settings.host.shutdownTimeoutMs,
  });
  resources.defer(unwireSignals);
  resources.defer(() => toolExecutions.close());
  if (settings.model.adapter === "codex") {
    codexVersion = await fetchLatestCodexVersion();
  }
  if (definition) {
    lease = createLease();
  }
  const session = { cwd: workspace, session: paths.dir },
    mcp = definition
      ? options.mcp
        ? await options.mcp(mode.sessionId, profiles, definition)
        : (ownedMcp = await loadSessionMcp(logger, settingsContext, definition.prefix.tools, {
            cwd: workspace,
          }))
      : (ownedMcp = await loadMcp(root, logger, settingsContext, { cwd: workspace })),
    frozenDefinition = definition ?? createSessionDefinition(settings, mcp, session);
  if (!definition) {
    db.createSession(mode.sessionId, workspace, profiles, frozenDefinition);
    sessionCreated = true;
    lease = createLease();
  }
  db.onChange((event) => options.observer?.transcript?.(mode.sessionId, event));
  logSessionOpened();
  const tools = mcp.modelTools(session),
    hooks = new HookRuntime(
      settings.hooks,
      tools,
      db.db,
      logger,
      mode.sessionId,
      workspace,
      mcp.freeformToolParameters,
      paths.dir,
    ),
    graph = buildGraph(settings, tools, frozenDefinition.prefix.tools.tools, db.db, hooks, {
      codexVersion,
      toolExecutions,
    });
  options.onReady?.({
    cancelTool: (callId) => toolExecutions.cancel(callId),
  });
  await hostLoop({
    assertLease: () => {
      requireLease().assertOwned();
    },
    controller,
    db,
    graph,
    logger,
    observer: options.observer,
    sessionId: mode.sessionId,
    settings,
    stopping: stoppingController.signal,
    wake: options.wake,
  });
  requireLease().assertOwned();
  function createLease() {
    return new HostLease(
      db,
      logger,
      mode.sessionId,
      controller,
      settings.leases.hostTtlMs,
      options.owner,
    );
  }
  function requireLease() {
    if (!lease) {
      throw new Error(localize("errors:host.leaseNotEstablished", { sessionId: mode.sessionId }));
    }
    return lease;
  }
  function logSessionOpened() {
    logger.info(localize(`errors:host.sessionOpened.${mode.kind}`), {
      db: paths.dbPath,
      sessionId: mode.sessionId,
    });
  }
}
