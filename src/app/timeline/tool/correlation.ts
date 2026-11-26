import { localize } from "../../frontend/i18n";
import type { DisplayEvent, DisplayToolCall } from "../contracts/projection";

interface StreamIdentityPart {
  formal?: true;
  id?: string;
  index?: number;
  kind: string;
}
interface StreamIdentityMessage {
  messageId: string;
  parts: Map<string, StreamIdentityPart>;
}
export function reconcileToolStreams(
  messages: Iterable<StreamIdentityMessage>,
  events: DisplayEvent[],
) {
  const byMessage = new Map([...messages].map((message) => [message.messageId, message]));
  for (const event of events) {
    if (event.kind === "tool_started") {
      const part = byMessage.get(event.messageId)?.parts.get(event.partId);
      if (part?.kind !== "tool_call_delta") {
        throw new Error(
          localize("diagnostics:transcript.toolStartStreamIdentityMissing", {
            streamId: streamCallKey(event.messageId, event.partId),
          }),
        );
      }
      if (part.id && !event.value.startsWith(part.id)) {
        throw new Error(
          localize("diagnostics:transcript.toolStreamCallIdMismatch", {
            previousCallId: part.id,
            receivedCallId: event.value,
          }),
        );
      }
      part.id = event.value;
      part.formal = true;
    }
  }
  validateFormalCallIds(byMessage.values());
}
export function sameToolCall(a: DisplayToolCall, b: DisplayToolCall) {
  const samePosition =
      a.messageId !== undefined && a.messageId === b.messageId && a.index === b.index,
    bothFormal = !a.temporary && !b.temporary;
  if (bothFormal) {
    if (samePosition && a.id !== b.id) {
      throw new Error(
        localize("diagnostics:transcript.toolStreamCallIdConflict", {
          firstCallId: a.id,
          secondCallId: b.id,
        }),
      );
    }
    if (
      a.id === b.id &&
      !samePosition &&
      a.messageId &&
      b.messageId &&
      (a.inputText === undefined) === (b.inputText === undefined)
    ) {
      throw new Error(
        localize("diagnostics:transcript.formalCallMultipleStreams", { callId: a.id }),
      );
    }
  }
  if (a.id === b.id && (!a.temporary || !b.temporary)) {
    return true;
  }
  return samePosition;
}
function validateFormalCallIds(messages: Iterable<StreamIdentityMessage>) {
  const owners = new Map<string, string>();
  for (const message of messages) {
    for (const [partId, part] of message.parts) {
      if (part.kind === "tool_call_delta" && part.formal && part.id) {
        const owner = streamCallKey(message.messageId, partId),
          existing = owners.get(part.id);
        if (existing && existing !== owner) {
          throw new Error(
            localize("diagnostics:transcript.formalCallMultipleStreamParts", { callId: part.id }),
          );
        }
        owners.set(part.id, owner);
      }
    }
  }
}
export function streamCallKey(messageId: string, partId: string) {
  return `stream:${messageId}:${partId}`;
}
export function displayToolCallKey(call: DisplayToolCall) {
  return call.messageId
    ? `message:${call.messageId}:index:${call.index.toString()}`
    : `call:${call.id}`;
}
