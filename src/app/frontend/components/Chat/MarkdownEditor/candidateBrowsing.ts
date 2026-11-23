import { clamp } from "es-toolkit";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export type InputDirection = "next" | "previous";
export interface CandidateCursor {
  content: string;
  draft: string;
  position: number;
}
const empty: readonly string[] = [];
function candidateText(
  position: number,
  draft: string,
  messages: readonly string[],
  predictions: readonly string[],
) {
  return position < 0 ? messages.at(position) : position > 0 ? predictions[position - 1] : draft;
}
export function currentCandidate(
  cursor: CandidateCursor | undefined,
  draft: string,
  messages: readonly string[],
  predictions: readonly string[] = empty,
): CandidateCursor {
  return cursor?.draft === draft &&
    candidateText(cursor.position, draft, messages, predictions) === cursor.content
    ? cursor
    : { content: draft, draft, position: 0 };
}
export function stepCandidate(
  cursor: CandidateCursor,
  direction: InputDirection,
  messages: readonly string[],
  predictions: readonly string[] = empty,
): CandidateCursor | undefined {
  const position = clamp(
      cursor.position + (direction === "previous" ? -1 : 1),
      -messages.length,
      predictions.length,
    ),
    content = candidateText(position, cursor.draft, messages, predictions);
  return content === undefined ? undefined : { ...cursor, content, position };
}
export function useMessageCandidates(
  value: string,
  onChange: (content: string) => void,
  messages: readonly string[],
  predictions: readonly string[] = empty,
) {
  const [snapshot, setSnapshot] = useState({ content: value, draft: value, position: 0 }),
    stateRef = useRef(snapshot),
    contentRef = useRef(value),
    current = currentCandidate(snapshot, value, messages, predictions);
  if (current !== snapshot) {
    setSnapshot(current);
  }
  const reset = useCallback((content = stateRef.current.draft) => {
    const next = { content, draft: content, position: 0 };
    stateRef.current = next;
    contentRef.current = content;
    setSnapshot(next);
  }, []);
  useLayoutEffect(() => {
    stateRef.current = snapshot;
    contentRef.current = snapshot.content;
  }, [snapshot]);
  const change = (content: string) => {
      if (content !== contentRef.current) {
        reset(content);
        onChange(content);
      }
    },
    navigate = (direction: InputDirection) => {
      const next = stepCandidate(stateRef.current, direction, messages, predictions);
      if (!next) {
        return;
      }
      stateRef.current = next;
      contentRef.current = next.content;
      setSnapshot(next);
      return next.content;
    };
  return { change, content: snapshot.content, contentRef, navigate, reset };
}
