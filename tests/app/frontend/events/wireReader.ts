import { EventSourceParserStream } from "eventsource-parser/stream";

export async function* readStateWire(response: Response) {
  if (!response.body) {
    throw new Error("State stream has no response body");
  }
  const events = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream({ onError: "terminate" }));
  for await (const { data, event, id } of events) {
    if (!event || !id) {
      throw new Error("State event is missing its name or ID");
    }
    yield new MessageEvent(event, { data, lastEventId: id });
  }
  throw new Error("State stream ended before the next event");
}
export async function nextStateEvent(wire: ReturnType<typeof readStateWire>) {
  const next = await wire.next();
  if (next.done) {
    throw new Error("State stream has no next event");
  }
  return next.value;
}
