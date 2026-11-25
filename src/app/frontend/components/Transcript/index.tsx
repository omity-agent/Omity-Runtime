import { type ComponentProps, useDeferredValue, useMemo, useRef } from "react";
import { css } from "styled-system/css";
import { Virtualizer, type VirtualizerHandle } from "virtua";

import type { TimelineMessage } from "../../../timeline";
import { useTranslation } from "../../i18n";
import { transcriptWindow } from "../../presentation/preferences";
import { stableScrollbar } from "../Chat/layout";
import { findLatestDetails } from "../Chat/messages/detailFocus";
import { Message } from "../Chat/messages/Message";
import { MessageCopies, useMessageCopies } from "./actions/PinnedCopy";
import { DisclosureProvider } from "./disclosures";
import { endShade, startShade } from "./scrolling/cues";
import { FlowItem, FlowWindow } from "./scrolling/FlowWindow";
import { useTranscriptScroll } from "./scrolling/viewportTracking";
import { segmentTranscript } from "./segments";

const viewport = css(stableScrollbar, {
    "&[data-overflow-end]": { "--transcript-end": 1 },
    "&[data-overflow-start]": { "--transcript-start": 1 },
    background: "bg.canvas",
    minHeight: "0",
    overflowAnchor: "none",
    overflowY: "auto",
    overscrollBehavior: "contain",
    position: "relative",
  }),
  content = css({ minWidth: "0", position: "relative", width: "full" });
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
        <div aria-hidden className={startShade} />
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
            {({ emphasized, key, message: item, partIndex }) => (
              <Message
                canFork={
                  allowFork && item.role === "user" && item.id > 0 && item.id !== firstUserMessageId
                }
                emphasized={emphasized}
                forkDisabled={forkDisabled}
                item={item}
                key={key}
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
            )}
          </Virtualizer>
          <MessageCopies handleRef={handleRef} registry={copies} />
        </div>
        <div aria-hidden className={endShade} />
      </section>
    </DisclosureProvider>
  );
}
