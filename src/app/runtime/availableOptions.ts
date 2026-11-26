import { loadConfiguredHookRules } from "../../infrastructure/configuration/hookRules";
import { readSkillCatalog } from "../../infrastructure/configuration/prompts/skillCatalog";
import {
  prioritizeSettingsProfile,
  type SettingsContext,
} from "../../infrastructure/configuration/settings/context";
import {
  loadAgentSettings,
  loadModelSettings,
} from "../../infrastructure/configuration/settings/load";
import { readProfileToolboxOptions } from "../../infrastructure/mcp/configuration";
import type { SessionOptions } from "../contracts/results";

export function availableSessionOptions(
  context: SettingsContext,
  profile?: string,
): SessionOptions {
  const selected = prioritizeSettingsProfile(context, profile),
    agent = loadAgentSettings(selected);
  return {
    ...readProfileToolboxOptions(selected),
    hooks: loadConfiguredHookRules(selected).map(({ id, enable, description }) => ({
      description,
      enable: enable ?? true,
      id,
    })),
    model: loadModelSettings(selected).model,
    prompts: agent.prompts.map((id) => ({ enable: true, id })),
    skills: Array.from(readSkillCatalog(agent.skills), ([id, { description }]) => ({
      description,
      enable: false,
      id,
    })),
  };
}
