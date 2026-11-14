import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { omit } from "es-toolkit";
import { stringify } from "yaml";

import { testSettings } from "./settings";

interface TestConfigurationOptions {
  agentYaml?: string;
  hooksYaml?: string;
  modelYaml?: string;
  systemPrompt?: string;
  skillsPrompt?: string;
}
export function writeTestConfiguration(root: string, options: TestConfigurationOptions = {}) {
  const settingsDir = join(root, "settings"),
    promptsDir = join(settingsDir, "prompts"),
    defaults = testSettings(),
    main = omit(defaults, ["agent", "hooks", "model", "skills", "toolExecution", "toolOutput"]),
    files = {
      agent:
        options.agentYaml ??
        stringify({
          prompts: ["system.md", "skills.md"],
          recursionLimit: 1,
          skills: defaults.skills,
          toolExecution: defaults.toolExecution,
          toolOutput: defaults.toolOutput,
        }),
      hooks: options.hooksYaml ?? "hooks: []\n",
      main: stringify({ ...main, logging: { ...main.logging, level: "debug" } }),
      model: options.modelYaml ?? stringify({ ...defaults.model, reasoning_effort: "medium" }),
    };
  mkdirSync(promptsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(settingsDir, `${name}.yaml`), content);
  }
  writeFileSync(join(promptsDir, "system.md"), options.systemPrompt ?? "test");
  writeFileSync(join(promptsDir, "skills.md"), options.skillsPrompt ?? `use skills\n\n\${skills}`);
  return settingsDir;
}
