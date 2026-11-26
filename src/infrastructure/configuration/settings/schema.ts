import ipaddr from "ipaddr.js";
import { z } from "zod";

import { localize } from "../../../i18n/server";
import { logLevelSchema } from "../../../types";
import { createAttachmentSettingsSchema, emptyAs, frontendSettingsSchema } from "./fieldSchemas";
import {
  createPredictionSettingsSchema,
  type parseModelSettings,
  prepareMainSettings,
} from "./models";

export { omitCodexConnectionSettings, parseModelSettings } from "./models";
const promptFileSchema = z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine(
      (value) =>
        value !== "." &&
        value !== ".." &&
        !value.includes("/") &&
        !value.includes("\\") &&
        !/[:*?"<>|\p{Cc}]/u.test(value),
      localize("configuration:settings.schema.promptFileNameInvalid"),
    ),
  promptsSchema = z
    .array(promptFileSchema)
    .refine(
      (files) => new Set(files).size === files.length,
      localize("configuration:settings.schema.duplicatePrompts"),
    ),
  agentSettingsSchema = z.strictObject({
    prompts: emptyAs(promptsSchema, []),
    recursionLimit: z.number().int().positive(),
    skills: z.strictObject({
      directory: z.string().min(1),
      enabled: z.boolean(),
      skillEnabled: emptyAs(z.record(z.string(), z.boolean()), {}),
    }),
    toolExecution: z.strictObject({
      parallel: z.boolean(),
    }),
    toolOutput: z.strictObject({
      maxTokens: z.number().int().positive(),
    }),
  }),
  publicOriginSchema = z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && url.origin === value;
    }, localize("configuration:settings.schema.publicOriginInvalid"))
    .nullable(),
  cidrSchema = z
    .string()
    .refine(
      (value) => ipaddr.isValidCIDR(value),
      localize("configuration:settings.schema.cidrInvalid"),
    ),
  accessSchema = z
    .strictObject({
      challengeTtlMs: z.number().int().min(1000).max(86_400_000),
      loginRateLimit: z.strictObject({
        attempts: z.number().int().positive().max(1000),
        windowMs: z.number().int().min(1000).max(86_400_000),
      }),
      publicOrigin: emptyAs(publicOriginSchema, null),
      sessionTtlMs: z.number().int().min(60_000).max(2_592_000_000),
      trustedProxies: emptyAs(z.array(cidrSchema), []),
    })
    .refine(
      ({ publicOrigin, trustedProxies }) => publicOrigin === null || trustedProxies.length > 0,
      localize("configuration:settings.schema.trustedProxiesRequired"),
    ),
  appSettingsSchema = z
    .strictObject({
      access: accessSchema,
      attachments: createAttachmentSettingsSchema(() =>
        localize("configuration:settings.schema.duplicateSuffixes"),
      ),
      frontend: frontendSettingsSchema,
      host: z.object({
        shutdownTimeoutMs: z.number().int().positive(),
      }),
      logging: z.object({
        level: logLevelSchema,
      }),
      server: z.strictObject({
        host: z.string().min(1),
        idleTimeoutSeconds: z.number().int().min(0).max(255),
        port: z.number().int().min(0).max(65_535),
        requestBodyLimitBytes: z.number().int().positive(),
      }),
    })
    .refine(
      ({ attachments, server }) =>
        Number.isSafeInteger(attachments.maxSizeBytes + server.requestBodyLimitBytes),
      {
        error: localize("configuration:settings.schema.attachmentBodyLimitUnsafe"),
        path: ["attachments", "maxSizeBytes"],
      },
    );
export function parseAppSettings(value: unknown) {
  return appSettingsSchema.parse(value);
}
export function parseMainSettings(value: unknown, model: ReturnType<typeof parseModelSettings>) {
  return appSettingsSchema
    .safeExtend({
      prediction: emptyAs(createPredictionSettingsSchema(model).optional(), undefined).optional(),
    })
    .parse(prepareMainSettings(value, model));
}
export function parseAgentSettings(value: unknown) {
  return agentSettingsSchema.parse(value);
}
