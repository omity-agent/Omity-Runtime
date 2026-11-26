import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { submissionForm } from "../../../../src/app/attachments/submission";
import { settingsProfileNames } from "../../../../src/infrastructure/configuration/settings/context";
import { readDefinitionRecord } from "../../../../src/infrastructure/database/records/session/metadata";
import { liveApplication } from "../liveApplication";

test("idle sessions can move a profile to the top without changing frozen tool schemas", async () => {
  await using app = liveApplication();
  const profileDirectory = join(app.context.userDirectory, "profiles", "alternate");
  mkdirSync(profileDirectory, { recursive: true });
  writeFileSync(join(profileDirectory, "model.yaml"), "model: alternate-model\n");
  const { id } = await app.createSession({ message: "first question" });
  await app.waitForRun(id);
  const { database } = app.controller,
    before = readDefinitionRecord(database.db, id),
    switched = await fetch(`${app.url}/api/sessions/${id}/profile`, {
      body: JSON.stringify({ profile: "alternate" }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  expect(switched.status).toBe(200);
  expect(await switched.json()).toMatchObject({ session: { id, profile: "alternate" } });
  const after = readDefinitionRecord(database.db, id);
  expect(database.profiles(id)).toEqual([...settingsProfileNames(app.context), "alternate"]);
  expect(after.prefix.model).toMatchObject({ model: "alternate-model" });
  expect(after.prefix.tools).toEqual(before.prefix.tools);
  await fetch(`${app.url}/api/sessions/${id}/messages`, {
    body: submissionForm(
      { content: "second question", draftRevision: 0, submissionId: "a1b2c3d4" },
      [],
    ),
    method: "POST",
  });
  await app.waitForRun(id);
  expect(
    z
      .array(z.object({ model: z.string() }))
      .parse(app.requests)
      .map(({ model }) => model),
  ).toEqual(["test", "alternate-model"]);
}, 15_000);
