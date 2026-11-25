import { type ComponentProps, useDeferredValue, useMemo, useRef } from "react";
import { css } from "styled-system/css";
import { Virtualizer, type VirtualizerHandle } from "virtua";

import type { TimelineMessage } from "../../../timeline";
import { useTranslation } from "../../i18n";
import { transcriptWindow } from "../../presentation/preferences";
import { findLatestDetails } from "../Chat/messages/detailFocus";
import { Message } from "../Chat/messages/Message";
import { MessageCopies, useMessageCopies } from "./actions/PinnedCopy";
import { DisclosureProvider } from "./disclosures";
import { FlowItem, FlowWindow } from "./scrolling/FlowWindow";
import { useTranscriptScroll } from "./scrolling/viewportTracking";
import { segmentTranscript } from "./segments";

const viewport = css({
    containerType: "size",
    minHeight: "0",
    overflowAnchor: "none",
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingInline: { _short: "3", base: "4", md: "6" },
    scrollbarGutter: "stable",
  }),
  content = css({ minWidth: "0", position: "relative", width: "full" }),
  segment = css({
    '&[data-first="true"]': { paddingBlockStart: { _short: "3", base: "4", md: "6" } },
    '&[data-last="true"]': { paddingBlockEnd: { _short: "3", base: "4", md: "6" } },
    display: "flow-root",
  });
type MessageActions = Pick<
  ComponentProps<typeof Message>,
  "forkDisabled" | "onCancelTool" | "onFork"
>;
export function Transcript({
  allowFork,
  forkDisabled,
  messages: incomingMessages,
  onCancelTool,
  onFork,
}: MessageActions & {
  allowFork: boolean;
  messages: TimelineMessage[];
}) {
  const { t } = useTranslation(),
    messages = useDeferredValue(incomingMessages),
    segments = useMemo(() => segmentTranscript(messages), [messages]),
    copies = useMessageCopies(segments),
    scrollRef = useRef<HTMLElement>(null),
    contentRef = useRef<HTMLDivElement>(null),
    handleRef = useRef<VirtualizerHandle>(null),
    firstUserMessageId = messages.find((item) => item.role === "user")?.id,
    latestDetails = findLatestDetails(messages),
    { onResize, registerDetail } = useTranscriptScroll({
      contentRef,
      handleRef,
      onLayout: copies.update,
      scrollRef,
    });
  return (
    <DisclosureProvider registerDetail={registerDetail}>
      <section
        aria-label={t("conversation:conversation")}
        className={viewport}
        ref={scrollRef}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The virtual viewport must accept focus for keyboard scrolling.
        tabIndex={0}
      >
        <div className={content} ref={contentRef}>
          <Virtualizer
            as={FlowWindow}
            bufferSize={transcriptWindow.bufferSize}
            data={segments}
            item={FlowItem}
            onResize={onResize}
            ref={handleRef}
            scrollRef={scrollRef}
          >
            {({ key, message: item, partIndex }, index) => (
              <div
                className={segment}
                data-first={index === 0}
                data-last={index === segments.length - 1}
                key={key}
              >
                <Message
                  canFork={
                    allowFork &&
                    item.role === "user" &&
                    item.id > 0 &&
                    item.id !== firstUserMessageId
                  }
                  forkDisabled={forkDisabled}
                  item={item}
                  latestReasoningIndex={
                    item.key === latestDetails.reasoning?.messageKey
                      ? latestDetails.reasoning.partIndex
                      : undefined
                  }
                  latestToolIndex={
                    item.key === latestDetails.tool?.messageKey
                      ? latestDetails.tool.partIndex
                      : undefined
                  }
                  onCancelTool={onCancelTool}
                  onFork={onFork}
                  partIndex={partIndex}
                />
              </div>
            )}
          </Virtualizer>
          <MessageCopies handleRef={handleRef} registry={copies} segments={segments} />
        </div>
      </section>
    </DisclosureProvider>
  );
}
