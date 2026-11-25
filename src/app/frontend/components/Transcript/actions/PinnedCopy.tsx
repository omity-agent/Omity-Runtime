import { type RefObject, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { css } from "styled-system/css";
import type { VirtualizerHandle } from "virtua";

import { localize } from "../../../i18n";
import { conversationLane } from "../../Chat/layout";
import { CopyButton } from "../../Chat/messages/CopyButton";
import type { segmentTranscript } from "../segments";
import { type MessageSpan, messageSpans, visibleCopies } from "./messageSpans";

interface MountedCopy {
  element: HTMLDivElement;
  span: MessageSpan;
}
const boundary = css({
    insetBlockStart: "0",
    insetInlineStart: "0",
    pointerEvents: "none",
    position: "absolute",
    width: "full",
    zIndex: "pinned",
  }),
  inset = css(conversationLane, { height: "full", paddingBlock: "2" }),
  toolbar = css({
    display: "flex",
    insetBlockStart: "2",
    justifyContent: "flex-end",
    position: "sticky",
  }),
  button = css({ color: "speaker.assistant", pointerEvents: "auto" });
function placeCopy(instance: VirtualizerHandle, { element, span }: MountedCopy) {
  const first = instance.getItemOffset(span.first),
    end = instance.getItemOffset(span.last) + instance.getItemSize(span.last),
    top = `${first.toString()}px`,
    height = `${(end - first).toString()}px`;
  if (element.style.top !== top) {
    element.style.top = top;
  }
  if (element.style.height !== height) {
    element.style.height = height;
  }
}
export function useMessageCopies(segments: ReturnType<typeof segmentTranscript>) {
  const mounted = useRef(new Map<string, MountedCopy>()),
    spans = useMemo(() => messageSpans(segments), [segments]),
    [range, setRange] = useState({ first: 0, last: -1 }),
    update = useCallback(
      (instance: VirtualizerHandle) => {
        for (const copy of mounted.current.values()) {
          placeCopy(instance, copy);
        }
        const first = instance.findItemIndex(instance.scrollOffset),
          last = instance.findItemIndex(instance.scrollOffset + instance.viewportSize);
        setRange((current) =>
          current.first === first && current.last === last ? current : { first, last },
        );
      },
      [mounted, setRange],
    ),
    register = useCallback(
      (instance: VirtualizerHandle, element: HTMLDivElement, span: MessageSpan) => {
        const copy = { element, span };
        mounted.current.set(span.message.key, copy);
        placeCopy(instance, copy);
        return () => {
          mounted.current.delete(span.message.key);
        };
      },
      [mounted],
    );
  return { range, register, spans, update };
}
export function MessageCopies({
  handleRef,
  registry,
}: {
  handleRef: RefObject<VirtualizerHandle | null>;
  registry: ReturnType<typeof useMessageCopies>;
}) {
  useLayoutEffect(() => {
    if (handleRef.current) {
      registry.update(handleRef.current);
    }
  });
  return visibleCopies(registry.range, registry.spans).map((span) => (
    <PinnedCopy
      handleRef={handleRef}
      key={span.message.key}
      register={registry.register}
      span={span}
    />
  ));
}
function PinnedCopy({
  handleRef,
  register,
  span,
}: {
  handleRef: RefObject<VirtualizerHandle | null>;
  register: ReturnType<typeof useMessageCopies>["register"];
  span: MessageSpan;
}) {
  const reference = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = reference.current,
      instance = handleRef.current;
    if (!element || !instance) {
      throw new Error(localize("diagnostics:transcript.copyAnchorMissing"));
    }
    return register(instance, element, span);
  }, [handleRef, register, span]);
  return (
    <div className={boundary} data-message-actions={span.message.key} ref={reference}>
      <div className={inset}>
        <div className={toolbar}>
          <CopyButton className={button} value={span.message.copyContent ?? span.message.content} />
        </div>
      </div>
    </div>
  );
}
