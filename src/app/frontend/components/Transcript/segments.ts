import type { TimelineMessage } from "../../../timeline";

interface TranscriptSegment {
  emphasized: boolean;
  key: string;
  message: TimelineMessage;
  partIndex?: number;
}
export function segmentTranscript(messages: TimelineMessage[]): TranscriptSegment[] {
  return messages.flatMap((message, messageIndex) => {
    const emphasized = messageIndex % 2 === 1;
    if (message.role === "user" || message.role === "system" || message.parts.length === 0) {
      return [{ emphasized, key: message.key, message }];
    }
    return message.parts.map((part, partIndex) => ({
      emphasized,
      key: `${message.key}:${part.type}:${part.type === "tool" ? part.key : partIndex.toString()}`,
      message,
      partIndex,
    }));
  });
}
