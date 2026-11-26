import { localize } from "../../../i18n/server";

const processExitedCode = "MCP_STDIO_PROCESS_EXITED",
  unavailableCode = "MCP_STDIO_UNAVAILABLE";
export class McpStdioProcessExitedError extends Error {
  readonly code = processExitedCode;
  override readonly name = "McpStdioProcessExitedError";
  constructor(
    readonly diagnostics?: string,
    readonly operation?: string,
    cause?: unknown,
  ) {
    super(localize("mcp:client.processExited"), cause === undefined ? undefined : { cause });
  }
}
export class McpStdioUnavailableError extends Error {
  readonly code = unavailableCode;
  override readonly name = "McpStdioUnavailableError";
  constructor(
    readonly serverName: string,
    readonly maxAttempts: number,
    cause?: unknown,
  ) {
    super(
      localize("mcp:client.unavailableAfterRestarts", {
        serverName,
        count: maxAttempts,
      }),
      cause === undefined ? undefined : { cause },
    );
  }
}
export function findMcpStdioUnavailable(error: unknown): McpStdioUnavailableError | undefined {
  const pending = [error],
    visited = new Set<unknown>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current !== undefined && !visited.has(current)) {
      visited.add(current);
      if (current instanceof McpStdioUnavailableError) {
        return current;
      }
      if (isRecord(current)) {
        if (current["cause"] !== undefined) {
          pending.push(current["cause"]);
        }
        if (Array.isArray(current["errors"])) {
          for (const failure of current["errors"]) {
            pending.push(failure);
          }
        }
      }
    }
  }
  return undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
