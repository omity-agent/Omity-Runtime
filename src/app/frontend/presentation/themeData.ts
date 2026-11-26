import { readFileSync } from "node:fs";

import {
  defineSemanticTokens,
  defineTextStyles,
  defineTokens,
  type SemanticTokens,
  type TextStyles,
  type Tokens,
} from "@pandacss/dev";
import { isPlainObject } from "es-toolkit";
import { parse } from "yaml";
import { z } from "zod";

export function readThemeData(directory: URL) {
  const colors = z
      .object({
        roles: z.custom<NonNullable<SemanticTokens["colors"]>>(isPlainObject),
        scale: z.custom<NonNullable<Tokens["colors"]>>(isPlainObject),
      })
      .parse(readTheme(directory, "colors.yaml")),
    metrics = z
      .object({
        adaptive: z.custom<SemanticTokens>(isPlainObject),
        breakpoints: z.record(z.string(), z.string()),
        dimensions: z.custom<Tokens>(isPlainObject),
      })
      .parse(readTheme(directory, "metrics.yaml")),
    typography = z
      .object({
        fonts: z.custom<NonNullable<Tokens["fonts"]>>(isPlainObject),
        styles: z.custom<TextStyles>(isPlainObject),
      })
      .parse(readTheme(directory, "typography.yaml"));
  return {
    breakpoints: metrics.breakpoints,
    semanticTokens: defineSemanticTokens({ ...metrics.adaptive, colors: colors.roles }),
    textStyles: defineTextStyles(typography.styles),
    tokens: defineTokens({ ...metrics.dimensions, colors: colors.scale, fonts: typography.fonts }),
  };
}
export function readViewportQueries(directory: URL) {
  return z
    .record(z.string().min(1), z.string().min(1))
    .parse(readTheme(directory, "viewport.yaml"));
}
function readTheme(directory: URL, name: string): unknown {
  return parse(readFileSync(new URL(name, directory), "utf8")) as unknown;
}
