import type { BaseMessage } from "@langchain/core/messages";
import { toUIMessageChunk } from "ai";

import { pendingToolBatch } from "../../agent/graph/toolBatch";
import { hasModelContent, type ModelStreamEvent } from "../../agent/model/request";
import { findToolStreamIdentity } from "../../infrastructure/database/records/transcript/toolStreamIdentity";
import { appendReasoningDelta, flushReasoning } from "../content";
import type { HostContext } from "../context";
import type { StreamLogState } from "../stream";
import { recordInvocation, toolStartedEvent } from "./invocations";
import { sequentialPart } from "./parts";

type StreamContext = Pick<HostContext, "db" | "logger" | "observer" | "sessionId" | "settings">;
export async function recordModelStreamPart(
  ctx: StreamContext,
  inputId: number,
  event: ModelStreamEvent,
  state: StreamLogState,
) {
  if (!state.modelResponding && hasModelContent(event.part)) {
    state.modelResponding = true;
    ctx.observer?.activity?.(ctx.sessionId, "streaming");
  }
  const chunk = toUIMessageChunk(event.part);
  if (chunk?.type === "reasoning-end") {
    const value = flushReasoning(state.parts.reasoning);
    if (!value) {
      return;
    }
    const { messageId } = state.parts;
    await ctx.db.appendStream(ctx.sessionId, {
      inputId,
      kind: "assistant_reasoning_delta",
      messageId,
      partId: sequentialPart(state.parts, "assistant_reasoning_delta"),
      value,
    });
    return;
  }
  if (chunk?.type === "text-delta" || chunk?.type === "reasoning-delta") {
    const kind = chunk.type === "text-delta" ? "assistant_text_delta" : "assistant_reasoning_delta",
      { messageId } = state.parts,
      value =
        chunk.type === "reasoning-delta"
          ? appendReasoningDelta(chunk.id, chunk.delta, state.parts.reasoning)
          : chunk.delta;
    await ctx.db.appendStream(ctx.sessionId, {
      inputId,
      kind,
      messageId,
      partId: sequentialPart(state.parts, kind),
      value,
    });
    if (chunk.type === "text-delta") {
      if (ctx.settings.logging.streamTokens) {
        ctx.logger.token(chunk.delta);
      }
      ctx.observer?.token(ctx.sessionId, inputId, chunk.delta);
    }
  } else {
    await recordInvocation(ctx, inputId, event, state);
  }
}
export function recordToolStarted(ctx: StreamContext, messages: BaseMessage[], inputId: number) {
  const events = pendingToolBatch(messages, ctx.settings.toolExecution.parallel).flatMap(
    ({ id: callId }) => {
      if (ctx.db.toolCancellation(ctx.sessionId, callId) !== undefined) {
        return [];
      }
      const identity = findToolStreamIdentity(ctx.db.db, ctx.sessionId, callId) ?? {
        messageId: callId,
        partId: callId,
      };
      return [toolStartedEvent(inputId, callId, identity)];
    },
  );
  ctx.db.appendPlainStreams(ctx.sessionId, events);
}
