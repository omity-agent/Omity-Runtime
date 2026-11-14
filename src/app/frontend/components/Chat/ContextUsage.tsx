import { DatabaseZap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import type { TokenUsage } from "../../../timeline";
import { formatTokens } from "../../tokenUnits";

const panel = css({
    alignItems: "end",
    borderBlockStartWidth: "hairline",
    borderTopColor: "border.default",
    color: "fg.subtle",
    display: { base: "flex", md: "grid" },
    flexWrap: "wrap",
    gap: "2",
    gridTemplateColumns: { base: "repeat(2, auto)", md: "1fr" },
    justifyContent: "space-between",
    paddingBlockStart: "3",
    textStyle: "contextUsage",
    whiteSpace: "nowrap",
    width: "full",
  }),
  row = css({
    alignItems: "center",
    display: "flex",
    gap: "1.5",
    justifyContent: "space-between",
  }),
  value = css({ color: "fg.muted" }),
  cacheNormal = css({ color: "status.tool" }),
  cacheWarning = css({ color: "status.error" });
export function ContextUsage({
  cacheHitWarningRatio,
  usage,
}: {
  cacheHitWarningRatio?: number;
  usage: TokenUsage | null;
}) {
  const { t } = useTranslation(),
    totalTokens =
      usage?.inputTokens !== undefined && usage.outputTokens !== undefined
        ? formatTokens(usage.inputTokens + usage.outputTokens)
        : t("unavailableTokens"),
    actualCacheHitRate =
      usage?.inputTokens !== undefined &&
      usage.inputTokens > 0 &&
      usage.cacheReadTokens !== undefined
        ? usage.cacheReadTokens / usage.inputTokens
        : undefined,
    cacheRate =
      actualCacheHitRate === undefined ? "—" : `${(actualCacheHitRate * 100).toFixed(2)}%`,
    belowExpectation =
      actualCacheHitRate !== undefined &&
      cacheHitWarningRatio !== undefined &&
      usage?.estimatedCacheHitRate !== undefined &&
      actualCacheHitRate + Number.EPSILON < usage.estimatedCacheHitRate * cacheHitWarningRatio,
    description = `${t("contextUsage")}: ${totalTokens}; ${t("kvCache")}: ${cacheRate}`;
  return (
    <div aria-label={description} className={panel} title={description}>
      <span className={row}>
        <span>{t("contextUsage")}</span>
        <span className={value}>{totalTokens}</span>
      </span>
      <span className={row}>
        <span className={row}>
          <DatabaseZap aria-hidden="true" size={12} />
          <span>{t("kvCache")}</span>
        </span>
        <span
          className={
            actualCacheHitRate === undefined ? value : belowExpectation ? cacheWarning : cacheNormal
          }
        >
          {cacheRate}
        </span>
      </span>
    </div>
  );
}
