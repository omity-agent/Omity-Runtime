import { useCallback, useRef, useState } from "react";

import {
  type CandidateCursor,
  currentCandidate,
  type InputDirection,
  stepCandidate,
} from "../../Chat/MarkdownEditor/candidateBrowsing";

export interface PreparationInput {
  content: string;
  handleChange: (content: string) => void;
  handleNavigate: (direction: InputDirection) => string | undefined;
  id: string;
}
export function usePreparationCandidates(messages: readonly string[]) {
  "use no memo";
  const [previews, setPreviews] = useState(() => new Map<string, CandidateCursor>()),
    active = useRef(previews),
    capture = useCallback((id: string, cursor?: CandidateCursor) => {
      if (!cursor && !active.current.has(id)) {
        return;
      }
      const next = new Map(active.current);
      if (cursor) {
        next.set(id, cursor);
      } else {
        next.delete(id);
      }
      active.current = next;
      setPreviews(next);
    }, []),
    reset = useCallback((id: string) => capture(id), [capture]),
    bind = useCallback(
      (id: string, draft: string, onChange: (content: string) => void): PreparationInput => {
        const current = () => currentCandidate(active.current.get(id), draft, messages);
        return {
          content: currentCandidate(previews.get(id), draft, messages).content,
          handleChange(content) {
            if (content !== current().content) {
              capture(id);
              onChange(content);
            }
          },
          handleNavigate(direction) {
            const next = stepCandidate(current(), direction, messages);
            if (next) {
              capture(id, next.position === 0 ? undefined : next);
            }
            return next?.content;
          },
          id,
        };
      },
      [capture, messages, previews],
    );
  return { bind, reset };
}
