import { afterAll, beforeAll, expect, test } from "bun:test";

import { expect as browserExpect } from "playwright/test";

import { BrowserSession } from "../scrolling/browserSession";
import { emitState, fixtureSessions, openPreparation } from "./preparationBrowser";

const browser = new BrowserSession();
beforeAll(() => browser.start(), 60_000);
afterAll(() => browser.stop());
test("session controls follow sidebar updates even when the transcript is still running", async () => {
  const fixture = await openPreparation(browser);
  await using page = fixture.page;
  const working = fixtureSessions[0]!,
    content = "A queued question",
    session = page.getByRole("region", { name: "项目会话" }).getByRole("link", { name: "Working" }),
    controls = page.getByRole("group", { name: "会话操作" }),
    pause = controls.getByRole("button", { exact: true, name: "暂停" }),
    resume = controls.getByRole("button", { name: "继续持续运行" }),
    step = controls.getByRole("button", { name: "向前一步" }),
    cancelPause = controls.getByRole("button", { name: "取消暂停" }),
    remove = controls.getByRole("button", { name: "删除会话" });
  await page.route("**/api/sessions/working/transcript", (route) =>
    route.fulfill({
      json: {
        control: "running",
        eventCursor: 0,
        events: [],
        fileLinks: [],
        messages: [],
        queue: [{ content, error: null, id: 1, status: "running", userMessageId: null }],
        reasoningTranslations: [],
        transcriptRevision: 1,
      },
    }),
  );
  await session.click();
  await browserExpect(page.getByText(content, { exact: true })).toBeVisible();
  await browserExpect(pause).toBeEnabled();

  await emitState(page, "session", { ...working, status: "pausing" });
  await browserExpect(session.getByLabel("正在暂停", { exact: true })).toBeVisible();
  await browserExpect(cancelPause).toBeEnabled();
  await emitState(page, "session", { ...working, status: "paused", stepAvailable: true });
  await browserExpect(session.getByLabel("暂停", { exact: true })).toBeVisible();
  await browserExpect(resume).toBeEnabled();
  await browserExpect(step).toBeEnabled();
  await browserExpect(cancelPause).toHaveCount(0);
  await browserExpect(remove).toBeEnabled();

  await emitState(page, "session", { ...working, status: "stepping" });
  await browserExpect(session.getByLabel("单步执行中", { exact: true })).toBeVisible();
  await browserExpect(controls.getByRole("button", { name: "单步执行中" })).toBeDisabled();
  await browserExpect(remove).toBeDisabled();
  await emitState(page, "session", working);
  await browserExpect(session.getByLabel("接收中", { exact: true })).toBeVisible();
  await browserExpect(pause).toBeEnabled();
  await emitState(page, "session", { ...working, status: "idle" });
  await browserExpect(session.getByLabel("空闲", { exact: true })).toBeVisible();
  await browserExpect(resume).toBeDisabled();
  await browserExpect(remove).toBeEnabled();
  expect(fixture.errors).toEqual([]);
}, 30_000);
