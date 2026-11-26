import { Writable } from "node:stream";

import type { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { localize } from "../../../i18n/server";
import type { StdioConnection } from "../configuration/connections";
import type { McpDiagnosticLimits } from "../configuration/declaration";
import { reportMcpFailure } from "../failures/reportConstruction";
import { ProcessOutputCapture } from "./diagnostics";
import { HandshakeEvidence } from "./handshakeEvidence";
import { observeStdioProcess } from "./processObservation";
import { connectProtocolClient } from "./protocol";

export interface ConnectedStdioClient {
  client: Client;
  close: () => Promise<void>;
  closed: Promise<void>;
  diagnostics: () => string;
  isClosed: () => boolean;
}
type StdioConnector = (
  serverName: string,
  connection: StdioConnection,
  limits: McpDiagnosticLimits,
  signal?: AbortSignal,
) => Promise<ConnectedStdioClient>;
export const connectStdioClient: StdioConnector = async (
  serverName,
  connection,
  limits,
  signal,
) => {
  const evidence = new HandshakeEvidence(limits.transportErrors),
    transport = new StdioClientTransport({
      args: connection.args,
      command: connection.command,
      cwd: connection.cwd,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).map(([name, value]) => [name, String(value)]),
        ),
        ...connection.env,
      },
      stderr: "pipe",
    }),
    { stderr } = transport,
    diagnostics = new ProcessOutputCapture(limits.stderrBytes),
    stdout = new ProcessOutputCapture(limits.stdoutBytes),
    processSnapshot = observeStdioProcess(transport, (chunk) => {
      if (evidence.isRecording()) {
        stdout.append(chunk);
      }
    });
  // eslint-disable-next-line unicorn/prefer-add-event-listener -- MCP transports expose callback properties instead of EventTarget APIs.
  transport.onerror = (error) => {
    evidence.record(error);
  };
  if (stderr === null) {
    throw reportMcpFailure(new Error(localize("mcp:connection.stderrUnavailable")), {
      connection: { kind: "stdio", options: connection },
      server: serverName,
      stage: "spawn",
    });
  }
  stderr.pipe(
    new Writable({
      write(chunk: unknown, _encoding, done) {
        diagnostics.append(chunk);
        done();
      },
    }),
  );
  const closed = Promise.withResolvers<void>();
  let isClosed = false;
  const closeTransport = () => {
    isClosed = true;
    closed.resolve();
  };
  try {
    const client = await connectProtocolClient(transport, { onclose: closeTransport, signal });
    return {
      client,
      close: async () => {
        await client.close();
        isClosed = true;
        closed.resolve();
      },
      closed: closed.promise,
      diagnostics: () => diagnostics.text(),
      isClosed: () => isClosed,
    };
  } catch (error) {
    const process = processSnapshot();
    throw reportMcpFailure(error, {
      ...evidence.snapshot(),
      connection: { kind: "stdio", options: connection },
      process,
      server: serverName,
      stage: process.pid === null || evidence.spawnFailed() ? "spawn" : "initialize",
      stderr: diagnostics.snapshot(),
      stdout: stdout.snapshot(),
    });
  } finally {
    evidence.stop();
  }
};
