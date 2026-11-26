import { Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import { formatToolInput } from "../../../../fileLinks/toolInput";
import {
  canCancelToolCall,
  type DisplayToolCall,
  type DisplayToolOutput,
  type ToolCallPhase,
} from "../../../timeline";
import { formatTokens } from "../../presentation/tokenUnits";
import { HighlightedCode } from "../HighlightedCode";
import { Frame } from "./Frame";
import { useToolAccessory } from "./ToolAccessory";

const ioGrid = css({
    display: "grid",
    gap: "3",
    gridTemplateColumns: {
      base: "minmax(0, 1fr)",
      xl: "repeat(2, minmax(0, 1fr))",
    },
    minWidth: "0",
    padding: "3",
  }),
  ioPanel = css({
    alignContent: "start",
    display: "grid",
    gap: "2",
    minWidth: "0",
  }),
  panelTitle = css({
    alignItems: "center",
    color: "fg.muted",
    display: "flex",
    fontSize: "metadata",
    justifyContent: "space-between",
  }),
  tokenCount = css({ color: "fg.muted", fontFamily: "mono" }),
  codeBlock = css({
    maxHeight: "toolOutput",
    minHeight: "toolOutputMinimum",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  }),
  imageList = css({ display: "grid", gap: "2" }),
  outputImage = css({ display: "block", height: "auto", maxWidth: "full" });
export function ToolCall({
  call,
  latest,
  onCancel,
  output,
  phase,
}: {
  call: DisplayToolCall;
  latest: boolean;
  onCancel: (toolCallId: string) => Promise<void>;
  output?: DisplayToolOutput;
  phase: ToolCallPhase;
}) {
  const { t } = useTranslation("conversation"),
    cancellable = canCancelToolCall(phase, call.providerExecuted),
    running = phase === "running",
    showOutput = output !== undefined || running,
    showOutputCode = output
      ? output.content.trim().length > 0 || output.images.length === 0
      : showOutput,
    inputCode = formatToolInput(call),
    frameAccessory = useToolAccessory({
      callId: call.id,
      cancellable,
      onCancel,
      phase,
    });
  return (
    <Frame
      accessory={frameAccessory}
      expandedInitially={latest}
      icon={Wrench}
      label={t("toolCall", { toolName: call.name })}
      stateKey={`tool:${call.id}:${latest ? "latest" : "settled"}`}
      title={call.name}
      tone="tool"
    >
      <div className={ioGrid}>
        <section className={ioPanel}>
          <p className={panelTitle}>
            <span>{t("input")}</span>
            <span className={tokenCount}>{formatTokens(t, call.inputTokens)}</span>
          </p>
          <HighlightedCode
            autoFollow={latest}
            className={codeBlock}
            code={inputCode}
            fileLinkMatches={call.fileLinks}
            language={call.rawInput === undefined ? "yaml" : "plaintext"}
          />
        </section>
        {showOutput ? (
          <section className={ioPanel}>
            <p className={panelTitle}>
              <span>{t("output")}</span>
              <span className={tokenCount}>
                {output ? formatTokens(t, output.outputTokens ?? 0) : t("tokens.unavailable")}
              </span>
            </p>
            {showOutputCode ? (
              <HighlightedCode
                autoFollow={latest}
                className={codeBlock}
                code={output?.content ?? ""}
                fileLinkMatches={output?.fileLinks}
                language={call.providerExecuted ? "yaml" : undefined}
              />
            ) : null}
            {output && output.images.length > 0 ? (
              <div className={imageList}>
                {output.images.map((image, index) => (
                  <img
                    alt=""
                    className={outputImage}
                    key={`${image.mimeType}-${index.toString()}`}
                    src={image.src}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Frame>
  );
}
