import { toUIMessageChunk } from "ai";
import { z } from "zod";

import type { ModelStreamEvent } from "../../agent/model/request";
import { captureError } from "../../failures/details";
import { localize } from "../../i18n/server";
import { findToolStreamIdentity } from "../../infrastructure/database/records/transcript/toolStreamIdentity";
import type { PlainStreamEventDraft } from "../../infrastructure/database/schema/streamEvent";
import type { HostContext } from "../context";
import type { StreamLogState } from "../stream";
import { displayToolInput, textOutputSnapshot, toolOutputText, toolValueText } from "../toolOutput";
import { toolPart } from "./parts";

type InvocationContext = Pick<HostContext, "db" | "sessionId">;
interface ToolIdentity {
  messageId: string;
  partId: string;
}
export const hookInvocationSchema = z.object({
  argumentsText: z.string(),
  callId: z.string().min(1),
  freeform: z.boolean(),
  kind: z.literal("hook_tool_started"),
  name: z.string().min(1),
});
export type HookInvocation = z.infer<typeof hookInvocationSchema>;

export function recordHookToolStarted(
  ctx: InvocationContext,
  inputId: number,
  { argumentsText, callId, freeform, name }: HookInvocation,
) {
  const existing = findToolStreamIdentity(ctx.db.db, ctx.sessionId, callId),
    identity = existing ?? { messageId: callId, partId: callId },
    events: PlainStreamEventDraft[] = [];
  if (!existing) {
    events.push({
      ...identity,
      inputId,
      kind: "tool_call_delta",
      value: {
        argumentsText,
        ...(freeform ? { freeform: true } : {}),
        idDelta: callId,
        index: 0,
        nameDelta: name,
      },
    });
  }
  events.push(toolStartedEvent(inputId, callId, identity));
  ctx.db.appendPlainStreams(ctx.sessionId, events);
}
export function toolStartedEvent(
  inputId: number,
  callId: string,
  { messageId, partId }: ToolIdentity,
): Extract<PlainStreamEventDraft, { kind: "tool_started" }> {
  return {
    inputId,
    kind: "tool_started",
    messageId,
    partId,
    value: callId,
  };
}
export async function recordInvocation(
  ctx: InvocationContext,
  inputId: number,
  event: ModelStreamEvent,
  state: StreamLogState,
) {
  const chunk = toUIMessageChunk(event.part);
  if (chunk?.type === "tool-input-start") {
    const identity = invocationIdentity(state, chunk.toolCallId);
    await ctx.db.appendStream(ctx.sessionId, {
      inputId,
      kind: "tool_call_delta",
      messageId: identity.messageId,
      partId: identity.partId,
      value: {
        ...(event.freeform ? { freeform: true } : {}),
        idDelta: chunk.toolCallId,
        index: identity.index,
        nameDelta: chunk.toolName,
        ...(chunk.providerExecuted ? { providerExecuted: true } : {}),
      },
    });
  } else if (chunk?.type === "tool-input-delta") {
    const identity = invocationIdentity(state, chunk.toolCallId);
    await ctx.db.appendStream(ctx.sessionId, {
      inputId,
      kind: "tool_call_delta",
      messageId: identity.messageId,
      partId: identity.partId,
      value: { argumentsDelta: chunk.inputTextDelta, index: identity.index },
    });
  } else if (chunk?.type === "tool-input-available" && chunk.providerExecuted) {
    const identity = invocationIdentity(state, chunk.toolCallId);
    ctx.db.appendPlainStreams(ctx.sessionId, [
      {
        inputId,
        kind: "tool_call_delta",
        messageId: identity.messageId,
        partId: identity.partId,
        value: {
          argumentsText: toolValueText(displayToolInput(chunk.input)),
          index: identity.index,
          providerExecuted: true,
        },
      },
      toolStartedEvent(inputId, chunk.toolCallId, identity),
    ]);
  } else if (
    (chunk?.type === "tool-output-available" || chunk?.type === "tool-output-error") &&
    chunk.providerExecuted
  ) {
    if (chunk.type === "tool-output-available" && chunk.preliminary) {
      return;
    }
    const identity = state.toolIndexes.has(chunk.toolCallId)
      ? invocationIdentity(state, chunk.toolCallId)
      : findToolStreamIdentity(ctx.db.db, ctx.sessionId, chunk.toolCallId);
    if (!identity) {
      throw new Error(
        localize("runtime:stream.toolResultCallMissing", { callId: chunk.toolCallId }),
      );
    }
    let content: string;
    if (chunk.type === "tool-output-error") {
      if (event.part.type !== "tool-error") {
        throw new Error(
          localize("runtime:stream.toolErrorEventInvalid", { callId: chunk.toolCallId }),
        );
      }
      content = toolOutputText(captureError(event.part.error));
    } else {
      content = toolOutputText(chunk.output);
    }
    await ctx.db.appendStream(ctx.sessionId, {
      inputId,
      kind: "tool_finished",
      messageId: identity.messageId,
      partId: identity.partId,
      value: { callId: chunk.toolCallId, output: textOutputSnapshot(content) },
    });
  }
}
function invocationIdentity(state: StreamLogState, callId: string) {
  let index = state.toolIndexes.get(callId);
  if (index === undefined) {
    index = state.toolIndexes.size;
    state.toolIndexes.set(callId, index);
  }
  return { index, messageId: state.parts.messageId, partId: toolPart(state.parts, index) };
}
