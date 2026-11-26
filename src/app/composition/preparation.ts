import type { TFunction } from "i18next";
import { z } from "zod";

import { settingsProfileNameSchema } from "../../infrastructure/configuration/settings/profileNames";

const sessionPreparationSchema = z.strictObject({
  builtInOverrides: z.record(z.string().min(1), z.boolean()).optional(),
  hookOverrides: z.record(z.string().min(1), z.boolean()).optional(),
  mcpOverrides: z.record(z.string().min(1), z.boolean()).optional(),
  message: z.string(),
  models: z.record(z.string(), z.string()).optional(),
  pairs: z.array(
    z.strictObject({
      assistant: z.string(),
      id: z.string().regex(/^[0-9a-z]{8}$/u),
      user: z.string(),
    }),
  ),
  profile: settingsProfileNameSchema.optional(),
  workspace: z.string().optional(),
});
export type SessionPreparation = z.infer<typeof sessionPreparationSchema>;
export type EditablePair = SessionPreparation["pairs"][number];
export function emptyPreparation(preferences?: SessionPreparation): SessionPreparation {
  return { ...preferences, message: "", pairs: [] };
}
export function createPreparationParser(t: TFunction<"drafts">) {
  const schema = sessionPreparationSchema.extend({
    pairs: sessionPreparationSchema.shape.pairs.refine(
      (pairs) => new Set(pairs.map(({ id }) => id)).size === pairs.length,
      { error: () => t("duplicateMessagePairId") },
    ),
  });
  return (content: string): SessionPreparation => schema.parse(JSON.parse(content));
}
