import { useQuery } from "@tanstack/react-query";

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
export function useSessionPreferences({
  draft,
  loading,
  update,
}: Pick<ReturnType<typeof useNewSessionDraft>, "draft" | "loading" | "update">) {
  const { profile } = draft,
    query = useQuery({
      enabled: !loading,
      queryFn: ({ signal }) => readSessionOptions(profile, signal),
      queryKey: ["sessionOptions", profile ?? null],
    }),
    hooks = resolveCapabilities(query.data?.hooks ?? [], draft.hookOverrides),
    mcpServers = resolveCapabilities(query.data?.mcpServers ?? [], draft.mcpOverrides),
    model = draft.models?.[profile ?? ""] ?? query.data?.model ?? "",
    ready = !loading && query.isSuccess && !query.isFetching,
    changeCapability = (
      kind: keyof Pick<SessionPreparation, "hookOverrides" | "mcpOverrides">,
      id: string,
      enable: boolean,
    ) => update((current) => ({ [kind]: { ...current[kind], [id]: enable } })),
    handleHookChange = (id: string, enable: boolean) =>
      changeCapability("hookOverrides", id, enable),
    handleServerChange = (id: string, enable: boolean) =>
      changeCapability("mcpOverrides", id, enable),
    handleModelChange = (value: string) =>
      update((current) => ({ models: { ...current.models, [profile ?? ""]: value } }));
  return {
    error: query.error,
    handleHookChange,
    handleModelChange,
    handleServerChange,
    hookOverrides: Object.fromEntries(hooks.map(({ id, enable }) => [id, enable])),
    hooks,
    mcpOverrides: Object.fromEntries(mcpServers.map(({ id, enable }) => [id, enable])),
    mcpServers,
    model,
    ready,
    reload: () => query.refetch(),
    valid: ready && model.trim().length > 0,
  };
}
