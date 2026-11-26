import { localize } from "../../i18n/server";
import { type HostContext, streamGraph } from "../context";
import type { StreamLogState } from "../stream";
import { hookInvocationSchema, recordHookToolStarted } from "./invocations";
import { recordModelStreamPart } from "./model";
import { TextStreamWriter } from "./textWriter";

export async function streamGraphSegment(
  ctx: HostContext,
  inputId: number,
  input: Parameters<typeof streamGraph>[1],
  config: Omit<Parameters<typeof streamGraph>[2], "signal" | "streamMode">,
  state: StreamLogState,
) {
  using execution = ctx.notifications.startOperation(ctx.controller.signal);
  await using writer = new TextStreamWriter(ctx, execution.signal);
  let completed = false;
  for await (const event of readEvents()) {
    if (!writer.signal.aborted) {
      await handleGraphEvent(ctx, inputId, event, state, writer);
    }
  }
  if (completed) {
    await writer.flush();
  }
  return completed && !writer.signal.aborted;

  async function* readEvents() {
    try {
      writer.signal.throwIfAborted();
      yield* await streamGraph(ctx.graph, input, {
        ...config,
        signal: writer.signal,
        streamMode: "custom",
      });
      completed = true;
    } catch (error) {
      if (!execution.interrupted()) {
        throw error;
      }
    }
  }
}
async function handleGraphEvent(
  ctx: HostContext,
  inputId: number,
  part: unknown,
  state: StreamLogState,
  writer: TextStreamWriter,
) {
  if (
    typeof part === "object" &&
    part !== null &&
    "kind" in part &&
    part.kind === "hook_tool_started"
  ) {
    await writer.flush();
    if (writer.signal.aborted) {
      return;
    }
    ctx.observer?.activity?.(ctx.sessionId, "tool");
    recordHookToolStarted(ctx, inputId, hookInvocationSchema.parse(part));
    return;
  }
  if (!isModelStreamEvent(part)) {
    throw new Error(localize("runtime:boundary.customEventInvalid"));
  }
  await recordModelStreamPart(ctx, inputId, part, state, writer);
}
function isModelStreamEvent(value: unknown): value is Parameters<typeof recordModelStreamPart>[2] {
  if (typeof value !== "object" || value === null || !("part" in value)) {
    return false;
  }
  const { part } = value;
  return typeof part === "object" && part !== null && "type" in part;
}
