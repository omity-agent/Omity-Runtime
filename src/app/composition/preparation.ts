import { z } from "zod";

import { localize } from "../../i18n/server";
import { settingsProfileNameSchema } from "../../infrastructure/configuration/settings/profileNames";

const sessionPreparationSchema = z.strictObject({
  builtInOverrides: z.record(z.string().min(1), z.boolean()).optional(),
  hookOverrides: z.record(z.string().min(1), z.boolean()).optional(),
  mcpOverrides: z.record(z.string().min(1), z.boolean()).optional(),
  message: z.string(),
  models: z.record(z.string(), z.string()).optional(),
  pairs: z
    .array(
      z.strictObject({
        assistant: z.string(),
        id: z.string().regex(/^[0-9a-z]{8}$/u),
        user: z.string(),
      }),
    )
    .refine(
      (pairs) => new Set(pairs.map(({ id }) => id)).size === pairs.length,
      localize("application:composition.duplicateMessagePairId"),
    ),
  profile: settingsProfileNameSchema.optional(),
  workspace: z.string().optional(),
});
export type SessionPreparation = z.infer<typeof sessionPreparationSchema>;
export type EditablePair = SessionPreparation["pairs"][number];
export function emptyPreparation(preferences?: SessionPreparation): SessionPreparation {
  return { ...preferences, message: "", pairs: [] };
}
export function parsePreparation(content: string): SessionPreparation {
  return sessionPreparationSchema.parse(JSON.parse(content));
}
export const preparationContentSchema = z.string().superRefine((content, context) => {
  try {
    parsePreparation(content);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: localize("application:composition.draftInvalid", {
        value0: error instanceof Error ? error.message : String(error),
      }),
    });
  }
});
