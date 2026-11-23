import type { FileLinkSet } from "../../fileLinks/types";
import { persistedTimelineMessage } from "./build/message";
import { syntheticMessage } from "./build/synthetic";
import type {
  DisplayEvent,
  DisplayToolCall,
  DisplayToolOutput,
  ReasoningTranslation,
  TimelineMessage,
} from "./contracts/projection";
import type { TranscriptSnapshot } from "./contracts/records";
import { groupAssistantMessages } from "./grouping";
import { streamTimelineMessages, toolCallLifecycle } from "./streamEvents";
import { sameToolCall } from "./tool/correlation";

export type {
  DisplayEvent,
  DisplayMessage,
  DisplayQueue,
  DisplayToolCall,
  DisplayToolOutput,
  TokenUsage,
  TimelineMessage,
  TimelinePart,
  ReasoningTranslation,
  ToolCallPhase,
} from "./contracts/projection";
export { canCancelToolCall } from "./contracts/projection";
export function buildTimeline({
  events,
  fileLinks,
  messages,
  queue,
  reasoningTranslations,
}: TranscriptSnapshot): TimelineMessage[] {
  const outputs = new Map(
      messages.flatMap((item) => [
        ...Object.entries(item.toolOutputs ?? {}),
        ...(item.role === "tool" && item.toolCallId
          ? [[item.toolCallId, item as DisplayToolOutput] as const]
          : []),
      ]),
    ),
    persistedToolCalls = messages.flatMap((item) => item.toolCalls),
    lifecycle = toolCallLifecycle(events, outputs),
    visible = messages
      .filter((item) => item.role !== "tool")
      .map((item) =>
        persistedTimelineMessage(item, outputs, lifecycle, fileLinks, reasoningTranslations),
      ),
    persistedSourceIds = new Set(
      messages.map((item) => item.sourceId).filter((id) => id !== undefined),
    ),
    knownInputs = new Set(messages.map((item) => item.inputId)),
    queuedUsers = new Map(
      queue
        .filter(
          (item) =>
            item.content.length > 0 && item.userMessageId == null && !knownInputs.has(item.id),
        )
        .map(
          (item) =>
            [
              item.id,
              syntheticMessage("user", item.content, `queue-${item.id.toString()}`),
            ] as const,
        ),
    ),
    activeQueueIds = new Set(
      queue
        .filter(
          (item) =>
            item.userMessageId !== null && (item.status === "running" || item.status === "paused"),
        )
        .map((item) => item.id),
    ),
    liveEvents = events.filter(
      (event) =>
        (event.kind === "user_appended" && queuedUsers.has(event.inputId)) ||
        (activeQueueIds.has(event.inputId) &&
          (event.kind === "tool_call_delta" || !persistedSourceIds.has(event.messageId))),
    ),
    live = timelineTail(
      liveEvents,
      queuedUsers,
      outputs,
      lifecycle,
      persistedToolCalls,
      fileLinks,
      reasoningTranslations,
    );
  return groupAssistantMessages([...visible, ...live]);
}
function timelineTail(
  events: DisplayEvent[],
  pending: Map<number, TimelineMessage>,
  outputs: Map<string, DisplayToolOutput>,
  lifecycle: ReturnType<typeof toolCallLifecycle>,
  persistedToolCalls: DisplayToolCall[],
  fileLinks: FileLinkSet[],
  reasoningTranslations: ReasoningTranslation[],
) {
  const result: TimelineMessage[] = [];
  let stream: DisplayEvent[] = [];
  const flushStream = () => {
    result.push(
      ...streamTimelineMessages(
        stream,
        outputs,
        lifecycle,
        fileLinks,
        reasoningTranslations,
      ).flatMap((message) => {
        const parts = message.parts.filter(
          (part) =>
            part.type !== "tool" ||
            !persistedToolCalls.some((call) => sameToolCall(call, part.call)),
        );
        return parts.length > 0 ? [{ ...message, parts }] : [];
      }),
    );
    stream = [];
  };
  for (const event of events) {
    if (event.kind === "user_appended") {
      const message = pending.get(event.inputId);
      if (message) {
        flushStream();
        result.push(message);
        pending.delete(event.inputId);
      }
    } else {
      stream.push(event);
    }
  }
  flushStream();
  for (const message of pending.values()) {
    result.push({ ...message, pending: true });
  }
  return result;
}
