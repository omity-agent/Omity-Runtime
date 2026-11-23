import { setTimeout as sleep } from "node:timers/promises";

import { once } from "es-toolkit";
import { raceSignal } from "race-signal";

import { captureError, summarizeError } from "../../../failures/details";
import { localize } from "../../../i18n/server";
import type { Logger } from "../../logging/logger";
import type { McpConfiguration } from "../configuration";
import type { StdioConnection } from "../configuration/connections";
import { McpStdioProcessExitedError, McpStdioUnavailableError } from "./availability";
import type { McpOperations } from "./protocol";
import { type ConnectedStdioClient, connectStdioClient } from "./stdio";

type StdioClientPolicy = Pick<McpConfiguration, "diagnostics" | "stdio">;
export class RestartingStdioClient implements McpOperations {
  private readonly controller = new AbortController();
  private current?: ConnectedStdioClient;
  private lastFailure?: unknown;
  private recovering?: Promise<ConnectedStdioClient>;
  private restartAttempts = 0;
  private unavailable?: McpStdioUnavailableError;
  private constructor(
    private readonly serverName: string,
    private readonly connection: StdioConnection,
    private readonly policy: StdioClientPolicy,
    private readonly logger: Logger,
  ) {}
  static async create(
    serverName: string,
    connection: StdioConnection,
    policy: StdioClientPolicy,
    logger: Logger,
  ) {
    const client = new RestartingStdioClient(serverName, connection, policy, logger);
    await client.connect();
    return client;
  }
  callTool: McpOperations["callTool"] = (params, options) =>
    this.invoke("callTool", (client) => client.callTool(params, options), options?.signal);
  getProtocolEra: McpOperations["getProtocolEra"] = () => this.current?.client.getProtocolEra();
  listTools: McpOperations["listTools"] = (params, options) =>
    this.invoke("listTools", (client) => client.listTools(params, options), options?.signal);
  readResource: McpOperations["readResource"] = (params, options) =>
    this.invoke("readResource", (client) => client.readResource(params, options), options?.signal);
  close = once(async () => {
    const reason = localize("mcp:client.closingServer", { value0: this.serverName });
    this.controller.abort(new Error(reason));
    try {
      await this.recovering;
    } catch (error) {
      if (error !== this.controller.signal.reason) {
        this.logger.error(
          localize("mcp:client.recoveryBeforeCloseFailed", { value0: this.serverName }),
          summarizeError(captureError(error)),
        );
      }
    }
    const { current } = this;
    this.current = undefined;
    await current?.close();
  });
  private async invoke<Result>(
    method: Exclude<keyof McpOperations, "getProtocolEra">,
    operation: (client: McpOperations) => Promise<Result>,
    signal?: AbortSignal,
  ) {
    this.controller.signal.throwIfAborted();
    if (this.unavailable) {
      this.unavailable = undefined;
      this.restartAttempts = 0;
    }
    signal?.throwIfAborted();
    const connection = this.current ?? (await raceSignal(this.ensureRecovery(), signal));
    this.controller.signal.throwIfAborted();
    try {
      const result = await operation(connection.client);
      this.restartAttempts = 0;
      this.lastFailure = undefined;
      return result;
    } catch (error) {
      if (signal?.aborted || !connection.isClosed()) {
        throw error;
      }
      const failure = this.recordClosure(connection, method, error);
      await raceSignal(this.ensureRecovery(), signal);
      throw failure;
    }
  }
  private async observeClosure(connection: ConnectedStdioClient) {
    await connection.closed;
    try {
      await this.recovering;
    } catch {
      return;
    }
    if (this.controller.signal.aborted || this.current !== connection) {
      return;
    }
    this.recordClosure(connection);
    try {
      await this.ensureRecovery();
    } catch {
      return;
    }
  }
  private recordClosure(
    connection: ConnectedStdioClient,
    operation?: "callTool" | "listTools" | "readResource",
    cause?: unknown,
  ) {
    const failure = new McpStdioProcessExitedError(
      connection.diagnostics() || undefined,
      operation,
      cause,
    );
    if (this.current === connection) {
      this.current = undefined;
      this.lastFailure = failure;
      this.logger.warn(
        `${failure.message}：${this.serverName}`,
        summarizeError(captureError(failure)),
      );
    }
    return failure;
  }
  private async ensureRecovery() {
    this.controller.signal.throwIfAborted();
    if (this.current) {
      return this.current;
    }
    if (this.unavailable) {
      throw this.unavailable;
    }
    this.recovering ??= this.recover();
    return this.recovering;
  }
  private async recover() {
    try {
      return await this.restart();
    } catch (error) {
      this.controller.signal.throwIfAborted();
      if (!(error instanceof McpStdioUnavailableError)) {
        this.logger.error(localize("mcp:client.recoveryFailed"), {
          error: error instanceof Error ? error.message : String(error),
          server: this.serverName,
        });
      }
      throw error;
    } finally {
      this.recovering = undefined;
    }
  }
  private async restart() {
    const { signal } = this.controller,
      { delayMs, maxAttempts } = this.policy.stdio.restart;
    while (this.restartAttempts < maxAttempts) {
      if (this.restartAttempts > 0) {
        await sleep(delayMs, undefined, { signal });
      }
      signal.throwIfAborted();
      const attempt = ++this.restartAttempts;
      try {
        const connection = await this.connect();
        this.logger.info(localize("mcp:client.processRestarted"), {
          attempt,
          server: this.serverName,
        });
        return connection;
      } catch (error) {
        if (signal.aborted) {
          throw signal.reason;
        }
        this.lastFailure = error;
        this.logger.warn(localize("mcp:client.processRestartFailed"), {
          attempt,
          maximum: maxAttempts,
          server: this.serverName,
        });
      }
    }
    this.unavailable = new McpStdioUnavailableError(this.serverName, maxAttempts, this.lastFailure);
    this.logger.error(this.unavailable.message, {
      lastFailure: summarizeError(captureError(this.lastFailure)),
    });
    throw this.unavailable;
  }
  private async connect() {
    const connection = await connectStdioClient(
      this.serverName,
      this.connection,
      this.policy.diagnostics,
      this.controller.signal,
    );
    this.current = connection;
    void this.observeClosure(connection);
    return connection;
  }
}
