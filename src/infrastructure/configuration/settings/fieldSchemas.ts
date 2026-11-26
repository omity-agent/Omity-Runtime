import { z } from "zod";

const suffixSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(32)
  .regex(/^\.[a-z0-9][a-z0-9_+-]*$/u);
export function createAttachmentSettingsSchema(duplicateSuffixes?: () => string) {
  return z.strictObject({
    allowedSuffixes: z
      .array(suffixSchema)
      .min(1)
      .refine((suffixes) => new Set(suffixes).size === suffixes.length, {
        error: duplicateSuffixes,
      }),
    maxSizeBytes: z.number().int().positive(),
  });
}
export const frontendSettingsSchema = z.strictObject({
  cacheHitWarningRatio: z.number().min(0).max(1),
  draftSaveDelayMs: z.number().int().positive(),
  reasoningTranslation: z.strictObject({
    enabled: z.boolean(),
    highConfidenceThreshold: z.number().min(0).max(1),
    minimumIntervalMs: z.number().int().nonnegative(),
  }),
  transcriptSnapshotThrottleMs: z.number().int().positive(),
});
export function emptyAs<T extends z.ZodType>(schema: T, empty: z.output<T>) {
  return z
    .union([schema, z.null(), z.literal("")])
    .transform((value) => (value === null || value === "" ? structuredClone(empty) : value));
}
