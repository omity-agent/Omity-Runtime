import { lastContentGroup } from "./contentSelection";
import type { TimelineMessage, TimelinePart } from "./contracts/projection";
import { sameToolCall } from "./tool/correlation";

export function joinTimeline(history: TimelineMessage[], tail: TimelineMessage[]) {
  const last = history.at(-1);
  if (last?.role === "assistant" && tail[0]?.role === "assistant") {
    const bridge = { ...last, parts: [...last.parts] };
    return [...history.slice(0, -1), ...groupAssistantMessages([bridge, ...tail])];
  }
  return tail.length === 0 ? history : [...history, ...groupAssistantMessages(tail)];
}
export function groupAssistantMessages(messages: TimelineMessage[]) {
  const result: TimelineMessage[] = [];
  let currentAssistant: TimelineMessage | undefined;
  for (const item of messages) {
    if (item.role !== "assistant") {
      currentAssistant = undefined;
      result.push(item);
    } else if (currentAssistant) {
      mergeAssistant(currentAssistant, item);
      currentAssistant.id = item.id;
    } else {
      currentAssistant = item;
      result.push(item);
    }
  }
  return result;
}
function mergeAssistant(target: TimelineMessage, source: TimelineMessage) {
  for (const part of source.parts) {
    if (
      part.type !== "tool" ||
      !toolParts(target).some((item) => sameToolCall(item.call, part.call))
    ) {
      target.parts.push(part);
    }
  }
  if (source.usage) {
    target.usage = source.usage;
  }
  target.content = [target.content, source.content]
    .filter((content) => content.trim().length > 0)
    .join("\n\n");
  target.copyContent = lastContentGroup(target.parts);
}
function toolParts(message: TimelineMessage) {
  return message.parts.filter(
    (part): part is Extract<TimelinePart, { type: "tool" }> => part.type === "tool",
  );
}
