import { expect, test } from "bun:test";

import { submissionForm } from "../../../src/app/attachments/submission";
import { AppController } from "../../../src/app/controller";
import { createApi } from "../../../src/app/http/handler";
import { liveApplication } from "./liveApplication";

const preparation = {
  hookOverrides: { "example-hook": false },
  mcpOverrides: { "example-server": true },
  message: "latest question",
  models: { "": "custom-default", alternate: "custom-alternate" },
  pairs: [
    { assistant: "first answer", id: "a1b2c3d4", user: "first question" },
    { assistant: "", id: "e5f6g7h8", user: "unfinished question" },
  ],
  profile: "alternate",
  workspace: "/projects/unsent",
};
test("new session drafts retain incomplete message pairs across controller reopening and reject stale saves", async () => {
  await using app = liveApplication();
  const endpoint = `${app.url}/api/session-preparation`,
    initial = await fetch(endpoint);
  expect(await initial.json()).toEqual({ content: null, revision: 0 });
  await saveDraft(endpoint, preparation, 4);
  expect(await saveDraft(endpoint, { message: "stale", pairs: [] }, 3)).toEqual({ revision: 4 });
  const reopened = new AppController(app.root);
  try {
    const restored = await createApi(reopened).request("/api/session-preparation");
    expect(await restored.json()).toEqual({
      content: JSON.stringify(preparation),
      revision: 4,
    });
  } finally {
    await reopened.close();
  }
  const edited = {
    ...preparation,
    message: "edited latest question",
    pairs: [{ ...preparation.pairs[0]!, assistant: "edited answer" }],
  };
  await saveDraft(endpoint, edited, 5);
  for (const content of [
    "not JSON",
    JSON.stringify({ ...edited, pairs: Array(2).fill(edited.pairs[0]) }),
  ]) {
    const response = await fetch(endpoint, {
      body: JSON.stringify({ content, revision: 6 }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
    expect(response.status).toBe(400);
  }
  await checkDraft(endpoint, edited, 5);
});
test("session creation clears only its submitted preparation and keeps drafts on failed creation", async () => {
  await using app = liveApplication();
  const endpoint = `${app.url}/api/session-preparation`,
    ready = { ...preparation, pairs: [preparation.pairs[0]!] };
  await saveDraft(endpoint, ready, 1);
  const failed = await create(app, "", 1);
  expect(failed.status).toBe(400);
  await checkDraft(endpoint, ready, 1);
  const created = await create(app, ready.message, 1);
  expect(created.status).toBe(200);
  await saveDraft(endpoint, ready, 1);
  await checkDraft(endpoint, { ...ready, message: "", pairs: [] }, 1);
  const newer = { message: "another tab's draft", pairs: [] };
  await saveDraft(endpoint, newer, 2);
  const olderCreation = await create(app, ready.message, 1);
  expect(olderCreation.status).toBe(200);
  await checkDraft(endpoint, newer, 2);
}, 15_000);
async function saveDraft(endpoint: string, content: unknown, revision: number): Promise<unknown> {
  const response = await fetch(endpoint, {
    body: JSON.stringify({ content: JSON.stringify(content), revision }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  expect(response.status).toBe(200);
  return response.json();
}
async function checkDraft(endpoint: string, content: unknown, revision: number) {
  const response = await fetch(endpoint);
  expect(await response.json()).toEqual({
    content: JSON.stringify(content),
    revision,
  });
}
function create(app: ReturnType<typeof liveApplication>, message: string, draftRevision: number) {
  return fetch(`${app.url}/api/sessions`, {
    body: submissionForm({ draftRevision, history: [], message, workspace: app.root }, []),
    method: "POST",
  });
}
