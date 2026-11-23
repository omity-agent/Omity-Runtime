import { afterAll, beforeAll, expect, test } from "bun:test";

import { expect as browserExpect } from "playwright/test";
import { z } from "zod";

import { sessionSubmissionSchema } from "../../../../src/app/attachments/submission";
import { BrowserSession } from "../scrolling/browserSession";
import { openPreparation, projectPaths } from "./preparationBrowser";

const browser = new BrowserSession();
beforeAll(() => browser.start(), 60_000);
afterAll(() => browser.stop());
test("new session restores all edits and pasted file bytes after navigation and reload", async () => {
  const fixture = await openPreparation(browser),
    { errors } = fixture;
  await using page = fixture.page;
  const workspace = page.getByRole("textbox", { name: "工作目录" }),
    profile = page.getByRole("combobox", { exact: true, name: "Profile" }),
    model = page.getByRole("textbox", { exact: true, name: "模型" }),
    hook = page.getByRole("switch", { exact: true, name: "shared-hook" }),
    optional = page.getByRole("switch", { exact: true, name: "optional-hook" }),
    server = page.getByRole("switch", { exact: true, name: "shared-server" }),
    builtIn = page.getByRole("switch", { exact: true, name: "ask_choices" }),
    users = page.locator(".cm-content"),
    assistant = users.nth(1),
    customWorkspace = `${projectPaths[1]}/unsent`;
  await workspace.fill(customWorkspace);
  await model.fill("custom-default");
  await optional.locator("..").click();
  await profile.selectOption("alternate");
  await browserExpect(model).toHaveValue("alternate-model");
  await model.fill("custom-alternate");
  await hook.locator("..").click();
  await server.locator("..").click();
  await builtIn.locator("..").click();
  await users.last().fill("prepared question");
  await users.last().evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["retained file bytes"], "notes.txt", { type: "text/plain" }));
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }));
  });
  const question = (await users.last().textContent())!;
  expect(question).toContain("{{file:");
  await page.getByRole("button", { name: "增加消息对" }).click();
  await browserExpect(users.first()).toHaveText(question);
  await browserExpect(users.last().locator(".cm-placeholder")).toBeVisible();
  await assistant.fill("prepared answer");
  await users.last().fill("latest question");
  await page
    .getByRole("region", { name: "项目会话" })
    .getByRole("link", { name: "Working" })
    .click();
  await page.getByRole("link", { exact: true, name: "新建会话" }).click();
  await browserExpect(workspace).toHaveValue(customWorkspace);
  await page.reload({ waitUntil: "networkidle" });
  await browserExpect(workspace).toHaveValue(customWorkspace);
  await browserExpect(profile).toHaveValue("alternate");
  await browserExpect(model).toHaveValue("custom-alternate");
  await browserExpect(hook).toBeChecked();
  await browserExpect(server).toBeChecked();
  await browserExpect(builtIn).not.toBeChecked();
  await profile.selectOption("limited");
  await browserExpect(optional).toHaveCount(0);
  await profile.selectOption("alternate");
  await browserExpect(optional).toBeChecked();
  await browserExpect(users.first()).toHaveText(question);
  await browserExpect(assistant).toHaveText("prepared answer");
  await browserExpect(users.last()).toHaveText("latest question");
  await profile.selectOption("");
  await browserExpect(model).toHaveValue("custom-default");
  await profile.selectOption("alternate");
  const submissions: FormData[] = [];
  await page.route("**/api/sessions", async (route) => {
    submissions.push(
      await new Response(new Uint8Array(route.request().postDataBuffer() ?? []), {
        headers: route.request().headers(),
      }).formData(),
    );
    await route.fulfill({
      json: { error: { code: "TEST_UNAVAILABLE", message: "temporarily unavailable" } },
      status: 503,
    });
  });
  await page.getByRole("button", { name: "创建并发送" }).click();
  await browserExpect(page.getByRole("button", { name: "创建并发送" })).toBeEnabled();
  expect(submissions).toHaveLength(1);
  const submission = sessionSubmissionSchema.parse(
      JSON.parse(z.string().parse(submissions[0]!.get("submission"))),
    ),
    fileKey = [...submissions[0]!.keys()].find((key) => key.startsWith("file:")),
    file = z.file().parse(submissions[0]!.get(fileKey!));
  expect(submission).toMatchObject({
    builtInOverrides: { choice: false },
    hookOverrides: { "shared-hook": true },
    mcpOverrides: { "shared-server": true },
    model: "custom-alternate",
    profile: "alternate",
    workspace: customWorkspace,
  });
  expect(submission.history[0]?.assistant).toBe("prepared answer");
  expect(submission.history[0]?.user.replaceAll("\n", "")).toBe(question);
  expect(submission.message).toBe("latest question");
  expect(file.name).toBe("notes.txt");
  expect(await file.text()).toBe("retained file bytes");
  await page.reload({ waitUntil: "networkidle" });
  await browserExpect(users.first()).toHaveText(question);
  expect(errors).toEqual([]);
}, 30_000);
test("refresh recovers edits before their pending server save finishes", async () => {
  const fixture = await openPreparation(browser);
  await using page = fixture.page;
  await page.route("**/api/session-preparation", (route) =>
    route.request().method() === "GET" ? route.fallback() : route.abort(),
  );
  const workspace = page.getByRole("textbox", { name: "工作目录" }),
    editor = page.locator(".cm-content");
  await workspace.fill(`${projectPaths[1]}/pending`);
  await editor.fill("not saved by the server yet");
  await page.reload({ waitUntil: "networkidle" });
  await browserExpect(workspace).toHaveValue(`${projectPaths[1]}/pending`);
  await browserExpect(editor).toHaveText("not saved by the server yet");
  expect(fixture.errors).toEqual([]);
}, 30_000);
