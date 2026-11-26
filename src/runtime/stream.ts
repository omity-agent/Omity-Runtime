import type { HostContext } from "./context";
import { createStreamPartState } from "./stream/parts";

export interface StreamLogState {
  modelResponding: boolean;
  parts: ReturnType<typeof createStreamPartState>;
  toolIndexes: Map<string, number>;
}
export function createStreamLogState(): StreamLogState {
  return {
    modelResponding: false,
    parts: createStreamPartState(),
    toolIndexes: new Map(),
  };
}
export function discardActiveStream(
  ctx: HostContext,
  state: StreamLogState,
  inputId: number,
  after: number,
) {
  ctx.db.discardStreamSegment(inputId, after);
  ctx.observer?.changed?.(ctx.sessionId);
  completeActiveStream(state);
}
export function completeActiveStream(state: StreamLogState) {
  state.toolIndexes.clear();
  state.modelResponding = false;
  state.parts = createStreamPartState();
}
