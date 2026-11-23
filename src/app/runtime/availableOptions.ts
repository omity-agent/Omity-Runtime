import { loadConfiguredHookRules } from "../../infrastructure/configuration/hookRules";
import {
  prioritizeSettingsProfile,
  type SettingsContext,
} from "../../infrastructure/configuration/settings/context";
import { loadModelSettings } from "../../infrastructure/configuration/settings/load";
import { readProfileToolboxOptions } from "../../infrastructure/mcp/configuration";
import type { SessionOptions } from "../contracts/results";

export function availableSessionOptions(
  context: SettingsContext,
  profile?: string,
): SessionOptions {
  const selected = prioritizeSettingsProfile(context, profile);
  return {
    ...readProfileToolboxOptions(selected),
    hooks: loadConfiguredHookRules(selected).map(({ id, enable, description }) => ({
      description,
      enable: enable ?? true,
      id,
    })),
    model: loadModelSettings(selected).model,
  };
}
