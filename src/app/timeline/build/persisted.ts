import type { FileLinkSet } from "../../../fileLinks/types";
import type {
  DisplayEvent,
  DisplayMessage,
  DisplayToolOutput,
  ReasoningTranslation,
} from "../contracts/projection";
import { groupAssistantMessages } from "../grouping";
import { toolCallLifecycle } from "../streamEvents";
import { persistedTimelineMessage } from "./message";

const projections = new WeakMap<DisplayMessage[], ReturnType<typeof prepare>>();
export function projectPersistedHistory(
  messages: DisplayMessage[],
  events: DisplayEvent[],
  links: FileLinkSet[],
  translations: ReasoningTranslation[],
) {
  return projections.getOrInsertComputed(messages, prepare)(
    events.filter(({ kind }) => kind === "tool_started" || kind === "tool_finished"),
    links,
    translations,
  );
}
function prepare(messages: DisplayMessage[]) {
  const outputs = new Map(
      messages.flatMap((item) => [
        ...Object.entries(item.toolOutputs ?? {}),
        ...(item.role === "tool" && item.toolCallId
          ? [[item.toolCallId, item as DisplayToolOutput] as const]
          : []),
      ]),
    ),
    calls = messages.flatMap((item) => item.toolCalls),
    sources = new Set(
      messages.flatMap(({ sourceId }) => (sourceId === undefined ? [] : [sourceId])),
    ),
    inputs = new Set(messages.map(({ inputId }) => inputId)),
    visible = messages.filter(({ role }) => role !== "tool");
  let previous: ReturnType<typeof render> | undefined;
  return (events: DisplayEvent[], links: FileLinkSet[], translations: ReasoningTranslation[]) => {
    if (
      !previous ||
      previous.links !== links ||
      previous.translations !== translations ||
      previous.events.length !== events.length ||
      events.some((event, index) => event.id !== previous?.events[index]?.id)
    ) {
      previous = render(events, links, translations);
    }
    return previous;
  };
  function render(
    events: DisplayEvent[],
    links: FileLinkSet[],
    translations: ReasoningTranslation[],
  ) {
    const lifecycle = toolCallLifecycle(events, outputs),
      history = groupAssistantMessages(
        visible.map((message) =>
          persistedTimelineMessage(message, outputs, lifecycle, links, translations),
        ),
      );
    return { calls, events, history, inputs, lifecycle, links, outputs, sources, translations };
  }
}
