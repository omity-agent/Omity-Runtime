import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parse, stringify } from "yaml";
import { z } from "zod";

import { createSettingsContext } from "../../src/infrastructure/configuration/settings/context";
import {
  parseAgentSettings,
  parseModelSettings,
} from "../../src/infrastructure/configuration/settings/schema";

const positive = z.number().int().positive(),
  contextSchema = z
    .strictObject({
      argumentTokens: positive,
      assistantOnlyMessages: z.number().int().nonnegative(),
      assistantTextMessages: positive,
      assistantTokens: positive,
      customToolCalls: z.number().int().nonnegative(),
      definitionTokens: positive,
      distinctHistoryTools: positive,
      encryptedReasoningCharacters: positive,
      humanMessages: positive,
      humanTokens: positive,
      reasoningMessages: positive,
      reasoningParts: positive,
      reasoningTokens: positive,
      systemTokens: positive,
      targetTokens: positive,
      toolDefinitions: positive,
      toolResultWeights: z.array(positive).min(1),
    })
    .superRefine((value, context) => {
      const assistants = value.toolResultWeights.length + value.assistantOnlyMessages;
      if (
        value.humanTokens < value.humanMessages ||
        value.assistantTokens < value.assistantTextMessages ||
        value.encryptedReasoningCharacters < value.reasoningMessages ||
        value.assistantTextMessages > assistants ||
        value.reasoningMessages > assistants ||
        value.reasoningMessages > value.reasoningParts ||
        value.reasoningParts > value.reasoningTokens ||
        value.distinctHistoryTools > value.toolDefinitions ||
        value.customToolCalls > value.toolResultWeights.length ||
        (value.customToolCalls > 0 && value.distinctHistoryTools < 2) ||
        value.assistantOnlyMessages > value.assistantTextMessages ||
        value.humanMessages > value.toolResultWeights.length + 1
      ) {
        context.addIssue({ code: "custom", message: "典型上下文的消息数量配置互相冲突" });
      }
    }),
  profileSchema = z.strictObject({
    agent: z.unknown().transform(parseAgentSettings),
    context: contextSchema,
    model: z
      .unknown()
      .transform(parseModelSettings)
      .transform((model) => {
        if (model.adapter !== "responses-sse" || model.baseURL !== "https://benchmark.invalid/v1") {
          throw new Error("性能测试只允许本地模拟的 Responses API 配置");
        }
        return model;
      }),
    samples: positive,
    timeoutMs: positive,
    warmup: z.number().int().nonnegative(),
  });
export type TypicalContext = z.infer<typeof contextSchema>;
export type LatencyProfile = z.infer<typeof profileSchema>;
export async function readLatencyProfile(repository: string) {
  const text = await readFile(join(repository, "settings/mcpLatency.yaml"), "utf8");
  return profileSchema.parse(parse(text) as unknown);
}
export async function prepareBenchmarkSettings(
  root: string,
  profile: LatencyProfile,
  systemPrompt: string,
  toolsPath: string,
) {
  const userDirectory = join(root, "benchmark-settings"),
    isolation = join(userDirectory, "profiles", "isolated"),
    directory = join(userDirectory, "profiles", "latency");
  await mkdir(join(directory, "prompts"), { recursive: true });
  await mkdir(isolation, { recursive: true });
  const files: [string, unknown][] = [
    [join(userDirectory, "main.yaml"), { prediction: null }],
    [join(isolation, "toolbox.yaml"), { mcpServers: {}, toolNameOverrides: {}, toolboxes: {} }],
    ...Object.entries({
      "agent.yaml": profile.agent,
      "hooks.yaml": { hooks: [] },
      "model.yaml": profile.model,
      "toolbox.yaml": {
        mcpServers: {
          bench: {
            args: [join(import.meta.dir, "emptyStdio.ts"), toolsPath],
            command: process.execPath,
          },
        },
      },
    }).map(([file, value]): [string, unknown] => [join(directory, file), value]),
  ];
  await Promise.all(files.map(([file, value]) => writeFile(file, stringify(value))));
  await writeFile(join(directory, "prompts/synthetic.md"), systemPrompt);
  return createSettingsContext(root, userDirectory, ["isolated", "latency"]);
}
