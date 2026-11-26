import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import { localize } from "../../../i18n/server";
import { abbreviateHomePath } from "../configuredPath";
import type { AgentSettings } from "../settings/definition";

const skillMetaSchema = z.object({
  description: z.string().min(1),
  name: z.string().min(1),
});
type SkillDocument = z.infer<typeof skillMetaSchema> & { content: string; source: string };
type SkillCatalog = Map<string, SkillDocument>;

export function readSkillCatalog({ directory, enabled }: AgentSettings["skills"]): SkillCatalog {
  const catalog: SkillCatalog = new Map();
  if (!enabled || !statSync(directory, { throwIfNoEntry: false })) {
    return catalog;
  }
  const entries = readdirSync(directory, { withFileTypes: true }).toSorted((left, right) =>
    left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    const skillDir = join(directory, entry.name);
    if (
      !entry.isDirectory() &&
      !(entry.isSymbolicLink() && statSync(skillDir, { throwIfNoEntry: false })?.isDirectory())
    ) {
      continue;
    }
    const source = join(skillDir, "SKILL.md");
    if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
      continue;
    }
    const skill = readSkill(source);
    if (catalog.has(skill.name)) {
      throw new Error(localize("errors:skills.duplicateName", { skillName: skill.name }));
    }
    catalog.set(skill.name, skill);
  }
  return catalog;
}
export function renderSkillIndex(
  { directory, enabled, skillEnabled }: AgentSettings["skills"],
  catalog: SkillCatalog,
) {
  if (!enabled) {
    return "";
  }
  for (const skillName of Object.keys(skillEnabled)) {
    if (!catalog.has(skillName)) {
      throw new Error(localize("errors:skills.unknownToggle", { skillName }));
    }
  }
  const skills = [...catalog.values()].filter(
      ({ name }) => !Object.hasOwn(skillEnabled, name) || skillEnabled[name],
    ),
    lines = [
      abbreviateHomePath(directory).replaceAll("\\", "/"),
      ...skills.map(
        ({ source, description }, index) =>
          `${index === skills.length - 1 ? "└──" : "├──"} ${relative(directory, source).replaceAll("\\", "/")} # ${description}`,
      ),
    ];
  if (skills.length === 0) {
    lines.push(localize("errors:skills.noneEnabled"));
  }
  return lines.join("\n");
}
export function renderSkillBlock({ name, content }: SkillDocument) {
  const stem = name.replaceAll(/[^a-z0-9_.-]/giu, "_").replace(/^[^a-z_]/iu, "_$&"),
    tag = `${stem}_skill`;
  return `<${tag}>\n${content.trimEnd()}\n</${tag}>`;
}
function readSkill(source: string): SkillDocument {
  const text = readFileSync(source, "utf8");
  if (!/^\uFEFF?---[ \t]*\r?\n/u.test(text)) {
    throw new Error(localize("errors:skills.frontMatterMissing", { path: source }));
  }
  const { content, data } = matter(text, { language: "yaml" });
  return { ...skillMetaSchema.parse(data), content, source };
}
