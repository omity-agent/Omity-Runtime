import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV4CallOptions, SharedV4ProviderOptions } from "@ai-sdk/provider";

import { localize } from "../../i18n/server";
import { conversationHeaders } from "../../infrastructure/openai/conversationHeaders";
import { createCodexConnection } from "../../infrastructure/openai/oauthConnection";
import type { ModelApi, ModelSettings, Settings } from "../../types";
import { createResponsesWebsocketFetch } from "./responsesWebsocket";
import { restrictedModelFetch } from "./restrictedFetch";

export function buildAiModel(settings: Settings, codexVersion?: string) {
  return buildConfiguredAiModel(settings.model, codexVersion);
}
export function buildConfiguredAiModel(model: ModelSettings, codexVersion?: string) {
  const api = configuredModelApi(model);
  if (api === "messages") {
    return createAnthropic(providerOptions(model, codexVersion))(model.model);
  }
  if (api === "interactions" || api === "generate-content") {
    const provider = createGoogle(providerOptions(model, codexVersion));
    return api === "interactions" ? provider.interactions(model.model) : provider(model.model);
  }
  const provider = createOpenAI(providerOptions(model, codexVersion));
  return api === "completions" ? provider.chat(model.model) : provider.responses(model.model);
}
export function conversationRequestOptions(
  model: ModelSettings,
  sessionId: string,
  turnId?: string,
): {
  headers?: Record<string, string>;
  reasoning?: LanguageModelV4CallOptions["reasoning"];
  providerOptions: SharedV4ProviderOptions;
} {
  const api = configuredModelApi(model);
  if (api === "messages" || api === "interactions" || api === "generate-content") {
    return structuredRequestOptions(model);
  }
  const openai = {
    forceReasoning: model.reasoning_effort !== undefined,
    promptCacheKey: sessionId,
    reasoningEffort: model.reasoning_effort,
    store: false,
    textVerbosity: "low" as const,
  };
  return api === "completions"
    ? { providerOptions: { openai } }
    : {
        ...(model.adapter === "codex" ? { headers: conversationHeaders(sessionId, turnId) } : {}),
        providerOptions: {
          openai: {
            ...openai,
            include: ["reasoning.encrypted_content"],
            reasoningSummary: "detailed",
          },
        },
      };
}
export function structuredRequestOptions(model: ModelSettings): {
  reasoning?: LanguageModelV4CallOptions["reasoning"];
  providerOptions: SharedV4ProviderOptions;
} {
  const api = configuredModelApi(model),
    effort = model.reasoning_effort;
  if (api === "generate-content") {
    return {
      providerOptions: { google: { thinkingConfig: { includeThoughts: true } } },
      reasoning: effort,
    };
  }
  if (api === "interactions") {
    if (effort === "none" || effort === "xhigh" || effort === "max") {
      throw new Error(localize("agent:model.interactionsReasoningEffortUnsupported", { effort }));
    }
    return {
      providerOptions: {
        google: { store: false, thinkingLevel: effort, thinkingSummaries: "auto" },
      },
    };
  }
  if (api === "messages") {
    if (effort === "minimal") {
      throw new Error(localize("agent:model.structuredReasoningEffortUnsupported"));
    }
    return {
      providerOptions: {
        anthropic:
          effort === undefined
            ? {}
            : effort === "none"
              ? { thinking: { type: "disabled" } }
              : { effort, thinking: { display: "summarized", type: "adaptive" } },
      },
    };
  }
  return {
    providerOptions: {
      openai: {
        reasoningEffort: model.reasoning_effort,
        store: false,
        textVerbosity: "low" as const,
      },
    },
  };
}
export function modelApi(settings: Settings): ModelApi {
  return configuredModelApi(settings.model);
}
function configuredModelApi(model: ModelSettings): ModelApi {
  switch (model.adapter) {
    case "codex":
    case "responses-sse":
    case "responses-websocket": {
      return "responses";
    }
    case "completions":
    case "messages":
    case "interactions":
    case "generate-content": {
      return model.adapter;
    }
    default: {
      throw new Error(localize("agent:model.adapterBranchMissing"));
    }
  }
}
function providerOptions(model: ModelSettings, codexVersion?: string) {
  if (model.adapter === "codex") {
    const connection = createCodexConnection({ codexVersion });
    return {
      apiKey: connection.apiKey,
      baseURL: connection.baseURL,
      fetch: restrictedModelFetch("responses", createResponsesWebsocketFetch(connection.websocket)),
    };
  }
  const apiKey = process.env[model.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      localize("agent:model.apiKeyEnvironmentMissing", { variableName: model.apiKeyEnv }),
    );
  }
  const api = configuredModelApi(model),
    fetch =
      model.adapter === "responses-websocket"
        ? restrictedModelFetch(api, createResponsesWebsocketFetch({ apiKey }))
        : restrictedModelFetch(api);
  return {
    apiKey,
    ...(model.baseURL ? { baseURL: model.baseURL } : {}),
    fetch,
  };
}
