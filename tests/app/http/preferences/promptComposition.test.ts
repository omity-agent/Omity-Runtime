import { expect, test } from "bun:test";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { sessionOptionsSchema } from "../../../../src/app/contracts/results";
import { readDefinitionRecord } from "../../../../src/infrastructure/database/records/session/metadata";
import { containingItems, partialObject } from "../../../support/asymmetric";
import { writeFixtureYaml } from "../../../support/configuration";
import { scopedEnvironment } from "../../../support/scopedEnvironment";
import { liveApplication } from "../liveApplication";

test("sessions apply configured prompt switches and append only opted-in skill bodies", async () => {
  await using app = liveApplication();
  using resources = new DisposableStack();
  const directory = join(app.root, "skills"),
    prompts = join(app.profileDirectory, "prompts"),
    files = ["header.md", "optional.md", "index.md", "tail.md"],
    path = join(homedir(), "example workspace"),
    body = `Review this workspace with ${path} and \${EXAMPLE_SKILL_VARIABLE}.`,
    appended = `<review-work_skill>\n${body}\n</review-work_skill>`;
  resources.use(scopedEnvironment({ EXAMPLE_PROMPT_PATH: path }));
  mkdirSync(prompts);
  writeFixtureYaml(app.profileDirectory, "agent", {
    prompts: files,
    skills: { directory, enabled: true, skillEnabled: {} },
  });
  writeFileSync(join(prompts, "header.md"), "Header: ${EXAMPLE_PROMPT_PATH}");
  writeFileSync(join(prompts, "optional.md"), "Optional prompt.");
  writeFileSync(join(prompts, "index.md"), "Index:\n${skills}");
  writeFileSync(join(prompts, "tail.md"), "Last configured prompt.");
  for (const [folder, name, text] of [
    ["review", "review-work", body],
    ["report", "write-report", "Report body should not be included."],
  ] as const) {
    mkdirSync(join(directory, folder), { recursive: true });
    writeFileSync(
      join(directory, folder, "SKILL.md"),
      `---\nname: ${name}\ndescription: Use ${name}\n---\n${text}\n`,
    );
  }
  const options = await fetch(`${app.url}/api/session-options`);
  expect(sessionOptionsSchema.parse(await options.json())).toMatchObject({
    prompts: files.map((id) => ({ enable: true, id })),
    skills: [
      { description: "Use write-report", enable: false, id: "write-report" },
      { description: "Use review-work", enable: false, id: "review-work" },
    ],
  });
  const snapshot = (id: string) =>
      readDefinitionRecord(app.controller.database.db, id).prefix.systemPrompt,
    original = await app.createSession();
  await app.waitForRun(original.id);
  const baseline = snapshot(original.id);
  expect(baseline.startsWith("Header: ~/example workspace\n\nOptional prompt.\n\nIndex:")).toBe(
    true,
  );
  expect(baseline).toContain("review/SKILL.md # Use review-work");
  expect(baseline).toContain("report/SKILL.md # Use write-report");
  expect(baseline.endsWith("Last configured prompt.")).toBe(true);
  expect(baseline).not.toContain("<review-work_skill>");
  expect(baseline).not.toContain("<write-report_skill>");

  for (const promptSelection of [
    { disabledPrompts: ["unknown.md"], enabledSkills: [] },
    { disabledPrompts: [], enabledSkills: ["unknown-skill"] },
  ]) {
    const invalid = await app.submitSession({ promptSelection });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "PROMPT_SELECTION_INVALID" } });
  }
  unlinkSync(join(prompts, "optional.md"));
  const selected = await app.createSession({
      promptSelection: { disabledPrompts: ["optional.md"], enabledSkills: ["review-work"] },
    }),
    expected = `${baseline.replace("Optional prompt.\n\n", "")}\n\n${appended}`;
  await app.waitForRun(selected.id);
  expect(snapshot(selected.id)).toBe(expected);
  expect(app.requests.at(-1)).toMatchObject({
    messages: containingItems([partialObject({ content: expected, role: "system" })]),
  });

  const alternate = join(app.context.userDirectory, "profiles", "alternate");
  mkdirSync(alternate, { recursive: true });
  writeFixtureYaml(alternate, "agent", { prompts: ["optional.md", "index.md", "tail.md"] });
  await app.controller.updateProfile(selected.id, "alternate");
  expect(snapshot(selected.id)).toBe(expected.replace("Header: ~/example workspace\n\n", ""));
}, 15_000);
