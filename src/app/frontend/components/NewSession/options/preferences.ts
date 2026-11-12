import { useQuery } from "@tanstack/react-query";
import { useReducer } from "react";

import { type CapabilityOption, sessionOptionsSchema } from "../../../../contracts/results";
import { api, request } from "../../../services/httpTransport";

export type { CapabilityOption } from "../../../../contracts/results";
interface SessionPreferences {
  hooks?: ReadonlyMap<string, boolean>;
  mcpServers?: ReadonlyMap<string, boolean>;
  models?: ReadonlyMap<string | undefined, string>;
}
type PreferenceUpdate =
  | { kind: "model"; profile?: string; value: string }
  | { enable: boolean; id: string; kind: "hooks" | "mcpServers" };
function updatePreferences(
  current: SessionPreferences,
  update: PreferenceUpdate,
): SessionPreferences {
  if (update.kind === "model") {
    const models = new Map(current.models);
    models.set(update.profile, update.value);
    return { ...current, models };
  }
  const values = new Map(current[update.kind]);
  values.set(update.id, update.enable);
  return { ...current, [update.kind]: values };
}
async function readSessionOptions(profile?: string, signal?: AbortSignal) {
  return request(
    api["session-options"].$get({ query: { profile } }, { init: { signal } }),
    sessionOptionsSchema,
  );
}
function resolveCapabilities(
  options: CapabilityOption[],
  overrides?: ReadonlyMap<string, boolean>,
) {
  return options.map((option) => ({
    ...option,
    enable: overrides?.get(option.id) ?? option.enable,
  }));
}
export function useSessionPreferences(profile?: string) {
  const [selections, dispatch] = useReducer(updatePreferences, {}),
    query = useQuery({
      queryFn: ({ signal }) => readSessionOptions(profile, signal),
      queryKey: ["sessionOptions", profile ?? null],
    }),
    hooks = resolveCapabilities(query.data?.hooks ?? [], selections.hooks),
    mcpServers = resolveCapabilities(query.data?.mcpServers ?? [], selections.mcpServers),
    model = selections.models?.get(profile) ?? query.data?.model ?? "",
    ready = query.isSuccess && !query.isFetching,
    handleHookChange = (id: string, enable: boolean) => dispatch({ enable, id, kind: "hooks" }),
    handleServerChange = (id: string, enable: boolean) =>
      dispatch({ enable, id, kind: "mcpServers" }),
    handleModelChange = (value: string) => dispatch({ kind: "model", profile, value });
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
