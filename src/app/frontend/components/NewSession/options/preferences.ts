import { useQuery } from "@tanstack/react-query";

import {
  changePromptSelection,
  type PromptSelection,
} from "../../../../../infrastructure/configuration/prompts/selection";
import type { SessionPreparation } from "../../../../composition/preparation";
import { type CapabilityOption, sessionOptionsSchema } from "../../../../contracts/results";
import { api, request } from "../../../services/httpTransport";
import type { useNewSessionDraft } from "../../../services/preparation/editorState";

export type { CapabilityOption } from "../../../../contracts/results";
async function readSessionOptions(profile?: string, signal?: AbortSignal) {
  return request(
    api["session-options"].$get({ query: { profile } }, { init: { signal } }),
    sessionOptionsSchema,
  );
}
function resolveCapabilities(options: CapabilityOption[], overrides?: Record<string, boolean>) {
  return options.map((option) => ({
    ...option,
    enable: overrides?.[option.id] ?? option.enable,
  }));
}
function resolveSelectedOptions(
  options: CapabilityOption[],
  ids: string[] | undefined,
  enable: boolean,
) {
  const selected = new Set(ids);
  return options.map((option) => (selected.has(option.id) ? { ...option, enable } : option));
}
export function useSessionPreferences({
  draft,
  loading,
  update,
}: Pick<ReturnType<typeof useNewSessionDraft>, "draft" | "loading" | "update">) {
  const { profile, promptSelection } = draft,
    query = useQuery({
      enabled: !loading,
      queryFn: ({ signal }) => readSessionOptions(profile, signal),
      queryKey: ["sessionOptions", profile ?? null],
    }),
    builtInTools = resolveCapabilities(query.data?.builtInTools ?? [], draft.builtInOverrides),
    hooks = resolveCapabilities(query.data?.hooks ?? [], draft.hookOverrides),
    mcpServers = resolveCapabilities(query.data?.mcpServers ?? [], draft.mcpOverrides),
    prompts = resolveSelectedOptions(
      query.data?.prompts ?? [],
      promptSelection?.disabledPrompts,
      false,
    ),
    skills = resolveSelectedOptions(query.data?.skills ?? [], promptSelection?.enabledSkills, true),
    model = draft.models?.[profile ?? ""] ?? query.data?.model ?? "",
    ready = !loading && query.isSuccess && !query.isFetching,
    changeCapability = (
      kind: keyof Pick<SessionPreparation, "builtInOverrides" | "hookOverrides" | "mcpOverrides">,
      id: string,
      enable: boolean,
    ) => update((current) => ({ [kind]: { ...current[kind], [id]: enable } })),
    changeSelection = (key: keyof PromptSelection, id: string, selected: boolean) =>
      update((current) => ({
        promptSelection: changePromptSelection(current.promptSelection, key, id, selected),
      })),
    handleBuiltInChange = (id: string, enable: boolean) =>
      changeCapability("builtInOverrides", id, enable),
    handleHookChange = (id: string, enable: boolean) =>
      changeCapability("hookOverrides", id, enable),
    handleServerChange = (id: string, enable: boolean) =>
      changeCapability("mcpOverrides", id, enable),
    handleModelChange = (value: string) =>
      update((current) => ({ models: { ...current.models, [profile ?? ""]: value } }));
  return {
    builtInOverrides: Object.fromEntries(builtInTools.map(({ id, enable }) => [id, enable])),
    builtInTools,
    error: query.error,
    handleBuiltInChange,
    handleHookChange,
    handleModelChange,
    handlePromptChange: (id: string, enable: boolean) =>
      changeSelection("disabledPrompts", id, !enable),
    handleServerChange,
    handleSkillChange: (id: string, enable: boolean) =>
      changeSelection("enabledSkills", id, enable),
    hookOverrides: Object.fromEntries(hooks.map(({ id, enable }) => [id, enable])),
    hooks,
    mcpOverrides: Object.fromEntries(mcpServers.map(({ id, enable }) => [id, enable])),
    mcpServers,
    model,
    prompts,
    promptSelection: {
      disabledPrompts: prompts.filter(({ enable }) => !enable).map(({ id }) => id),
      enabledSkills: skills.filter(({ enable }) => enable).map(({ id }) => id),
    },
    ready,
    reload: () => query.refetch(),
    skills,
    valid: ready && model.trim().length > 0,
  };
}
