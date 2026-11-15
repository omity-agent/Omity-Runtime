import { clamp } from "es-toolkit";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export type InputDirection = "next" | "previous";
const empty: readonly string[] = [];
export function useMessageCandidates(
  value: string,
  onChange: (content: string) => void,
  messages: readonly string[],
  predictions: readonly string[] = empty,
) {
  const [snapshot, setSnapshot] = useState({ content: value, draft: value, position: 0 }),
    stateRef = useRef(snapshot),
    contentRef = useRef(value),
    candidate =
      snapshot.position < 0 ? messages.at(snapshot.position) : predictions[snapshot.position - 1];
  if (snapshot.draft !== value || (snapshot.position !== 0 && candidate !== snapshot.content)) {
    setSnapshot({ content: value, draft: value, position: 0 });
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
      const position = clamp(
          stateRef.current.position + (direction === "previous" ? -1 : 1),
          -messages.length,
          predictions.length,
        ),
        content =
          position < 0
            ? messages.at(position)
            : position > 0
              ? predictions[position - 1]
              : stateRef.current.draft;
      if (content === undefined) {
        return;
      }
      const next = { ...stateRef.current, content, position };
      stateRef.current = next;
      contentRef.current = content;
      setSnapshot(next);
      return content;
    };
  return { change, content: snapshot.content, contentRef, navigate, reset };
}
