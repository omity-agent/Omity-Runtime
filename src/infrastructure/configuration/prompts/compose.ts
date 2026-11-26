import { join } from "node:path";

import { DomainError } from "../../../failures/domain";
import { localize } from "../../../i18n/server";
import { abbreviateHomePath } from "../configuredPath";
import { type PlaceholderOptions, readSettingsText } from "../placeholders";
import type { SettingsContext } from "../settings/context";
import type { AgentSettings } from "../settings/definition";
import { resolveLayeredSettingsText } from "../settings/files";
import type { PromptSelection } from "./selection";
import { readSkillCatalog, renderSkillBlock, renderSkillIndex } from "./skillCatalog";

export interface PromptComposition {
  kind: "submission" | "profile";
  selection?: PromptSelection;
}
export function composeSystemPrompt(
  context: SettingsContext,
  agent: AgentSettings,
  placeholders: Omit<PlaceholderOptions, "source">,
  composition?: PromptComposition,
) {
  const { disabledPrompts, enabledSkills } = composition?.selection ?? {},
    omitted = new Set(disabledPrompts),
    included = new Set(enabledSkills);
  if (composition?.kind === "submission") {
    for (const id of omitted) {
      if (!agent.prompts.includes(id)) {
        throw new DomainError(
          "PROMPT_SELECTION_INVALID",
          localize("errors:prompts.unknownPrompt", { promptName: id }),
        );
      }
    }
  }
  let catalog: ReturnType<typeof readSkillCatalog> | undefined, index: string | undefined;
  const skills = () => (catalog ??= readSkillCatalog(agent.skills)),
    options = {
      ...placeholders,
      dynamic: (name: string) => {
        switch (name) {
          case "skills":
            return { matched: true, value: (index ??= renderSkillIndex(agent.skills, skills())) };
          case "toolOutputMaxTokens":
            return { matched: true, value: agent.toolOutput.maxTokens };
          default:
            return { matched: false };
        }
      },
      formatPath: abbreviateHomePath,
    },
    sections = agent.prompts
      .filter((id) => !omitted.has(id))
      .map((id) =>
        readSettingsText(
          resolveLayeredSettingsText(context, "profile", join("prompts", id)),
          options,
        ).trimEnd(),
      );
  if (included.size > 0) {
    const installed = skills();
    for (const id of included) {
      if (composition?.kind === "submission" && !installed.has(id)) {
        throw new DomainError(
          "PROMPT_SELECTION_INVALID",
          localize("errors:prompts.unknownSkill", { skillName: id }),
        );
      }
    }
    for (const [id, skill] of installed) {
      if (included.has(id)) {
        sections.push(renderSkillBlock(skill));
      }
    }
  }
  return sections.join("\n\n");
}
