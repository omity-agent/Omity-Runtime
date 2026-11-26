import { setTimeout as sleep } from "node:timers/promises";

import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";

import type { buildGraph } from "../agent";
import type { ErrorDetails } from "../failures/details";
import { localize } from "../i18n/server";
import type { AgentDatabase } from "../infrastructure/database/agentDatabase";
import type { Logger } from "../infrastructure/logging/logger";
import type { BrowserWarning, HostActivity, Settings, StreamEvent } from "../types";

type AgentGraph = ReturnType<typeof buildGraph>;
type AgentGraphStream = AgentGraph["stream"];
type GraphStreamOptions = Omit<
  NonNullable<Parameters<AgentGraphStream>[1]>,
  "interruptAfter" | "interruptBefore"
> & {
  interruptAfter: string[];
  interruptBefore: string[];
};
export interface HostObserver {
  activity?: (sessionId: string, status: HostActivity) => void;
  changed?: (sessionId: string) => void;
  failure?: (sessionId: string, error: ErrorDetails) => void;
  transcript?: (sessionId: string, event: StreamEvent) => void;
  token: (sessionId: string, inputId: number, text: string) => void;
  warning?: (sessionId: string, warning: BrowserWarning) => void;
}
export type HostWake = (delayMs: number, signal: AbortSignal) => Promise<void>;
export interface HostContext {
  assertLease?: () => void;
  controller: AbortController;
  db: AgentDatabase;
  graph: AgentGraph;
  logger: Logger;
  observer?: HostObserver;
  sessionId: string;
  settings: Settings;
  stopping?: AbortSignal;
  wake?: HostWake;
}
export async function streamGraph(
  graph: Pick<AgentGraph, "stream">,
  input: Parameters<AgentGraphStream>[0],
  options: GraphStreamOptions,
) {
  const stream: unknown = Reflect.get(graph, "stream");
  if (typeof stream !== "function") {
    throw new TypeError(localize("runtime:graph.streamMethodMissing"));
  }
  const result: unknown = await Reflect.apply(stream, graph, [input, options]);
  if (!isIterable(result)) {
    throw new Error(localize("runtime:graph.streamNotIterable"));
  }
  return result;
}
export function waitForWake(
  ctx: Pick<HostContext, "controller" | "wake">,
  delayMs: number,
  signal = ctx.controller.signal,
) {
  if (signal.aborted) {
    return Promise.resolve();
  }
  return ctx.wake ? ctx.wake(delayMs, signal) : abortableSleep(delayMs, signal);
}
async function abortableSleep(delayMs: number, signal: AbortSignal) {
  try {
    await sleep(delayMs, undefined, { signal });
  } catch (error) {
    if (!signal.aborted) {
      throw error;
    }
  }
}
const messageSchema = z.custom<BaseMessage>((value) => BaseMessage.isInstance(value)),
  graphStateSchema = z.looseObject({
    next: z.array(z.string()),
    tasks: z.array(z.looseObject({ name: z.string() })),
    values: z.looseObject({
      hookPendingUserIds: z.array(z.string()).optional(),
      hookPlan: z.unknown().optional(),
      messages: z.array(messageSchema),
    }),
  });
export async function readGraphState(
  graph: Pick<AgentGraph, "getState">,
  config: Parameters<AgentGraph["getState"]>[0],
) {
  const snapshot = await graph.getState(config);
  if (snapshot.createdAt === undefined) {
    return undefined;
  }
  const parsed = graphStateSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new Error(localize("runtime:graph.invalidState"), { cause: parsed.error });
  }
  return parsed.data;
}
function isIterable(value: unknown): value is AsyncIterable<unknown> | Iterable<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    (typeof Reflect.get(value, Symbol.asyncIterator) === "function" ||
      typeof Reflect.get(value, Symbol.iterator) === "function")
  );
}
