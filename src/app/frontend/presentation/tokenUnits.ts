import type { TFunction } from "i18next";

export function formatTokens(t: TFunction<"conversation">, tokens: number) {
  if (tokens <= 1000) {
    return t("tokens.exact", { count: tokens });
  }
  const precision = tokens < 10_000 ? 1 : 0,
    thousands = Number((tokens / 1000).toFixed(precision));
  return t("tokens.thousands", { count: tokens, thousands });
}
