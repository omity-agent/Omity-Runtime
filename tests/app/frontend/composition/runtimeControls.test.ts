import { expect, test } from "bun:test";

import { expect as browserExpect } from "playwright/test";

import { browserFixture, settleLayout } from "../scrolling/browserSession";
import { emitState, emptyTranscript, fixtureSessions, openPreparation } from "./preparationBrowser";

const browser = browserFixture();
test("session controls follow live status and Ctrl-click upgrades a pending pause", async () => {
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
    remove = controls.getByRole("button", { name: "删除会话" }),
    commands: unknown[] = [];
  await page.route("**/api/sessions/working/control", (route) => {
    const json: unknown = route.request().postDataJSON();
    commands.push(json);
    return route.fulfill({ json });
  });
  await page.route("**/api/sessions/working/transcript", (route) =>
    route.fulfill({ json: queuedTranscript(content, 1) }),
  );
  await session.click();
  await browserExpect(page.getByText(content, { exact: true })).toBeVisible();
  await browserExpect(pause).toBeEnabled();
  await pause.click();
  await browserExpect.poll(() => commands).toEqual([{ control: "pause" }]);

  await emitState(page, "session", { ...working, status: "pausing" });
  await browserExpect(session.getByLabel("正在暂停", { exact: true })).toBeVisible();
  await cancelPause.click({ modifiers: ["Control"] });
  await browserExpect.poll(() => commands.at(-1)).toEqual({ control: "force_pause" });
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
  await pause.click({ modifiers: ["Control"] });
  await browserExpect
    .poll(() => commands)
    .toEqual([{ control: "pause" }, { control: "force_pause" }, { control: "force_pause" }]);
  await emitState(page, "session", working);
  await browserExpect(session.getByLabel("接收中", { exact: true })).toBeVisible();
  await browserExpect(pause).toBeEnabled();
  await emitState(page, "session", { ...working, status: "idle" });
  await browserExpect(session.getByLabel("空闲", { exact: true })).toBeVisible();
  await browserExpect(resume).toBeDisabled();
  await browserExpect(remove).toBeEnabled();
  expect(fixture.errors).toEqual([]);
}, 30_000);
test("sync bursts during a pending transcript request schedule one later snapshot", async () => {
  const fixture = await openPreparation(browser);
  await using page = fixture.page;
  const initial = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>(),
    latest = "Changed without a new stream event";
  let reads = 0;
  await page.route("**/api/sessions/working/transcript", async (route) => {
    const revision = ++reads;
    if (revision === 1) {
      initial.resolve();
      await release.promise;
    }
    await route.fulfill({
      json: queuedTranscript(revision === 1 ? "Previous snapshot" : latest, revision),
    });
  });
  await page
    .getByRole("region", { name: "项目会话" })
    .getByRole("link", { name: "Working" })
    .click();
  try {
    await initial.promise;
    await page.evaluate(() => {
      for (let index = 0; index < 3; index += 1) {
        dispatchEvent(new MessageEvent("sync", { data: '{"eventCursor":0}', lastEventId: "0" }));
      }
    });
    await settleLayout(page);
    expect(reads).toBe(1);
  } finally {
    release.resolve();
  }
  await browserExpect(page.getByText(latest, { exact: true })).toBeVisible();
  expect(reads).toBe(2);
  expect(fixture.errors).toEqual([]);
}, 30_000);
test("a pending Fork does not disable another session or override its route", async () => {
  const fixture = await openPreparation(browser);
  await using page = fixture.page;
  const started = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>(),
    applied = Promise.withResolvers<void>(),
    sessions = page.getByRole("region", { name: "项目会话" }),
    branch = { ...fixtureSessions[1]!, id: "branch", status: "paused", title: "Branch" };
  await page.route("**/api/sessions/history/transcript", (route) =>
    route.fulfill({
      json: {
        ...queuedTranscript("", 1),
        messages: ["First question", "Second question"].map((content, index) => ({
          content,
          createdAt: 1,
          id: index + 1,
          images: [],
          inputId: null,
          reasoning: "",
          role: "user",
          toolCalls: [],
        })),
        queue: [],
      },
    }),
  );
  await page.route("**/api/sessions/history/fork/materialize", async (route) => {
    started.resolve();
    await release.promise;
    await route.fulfill({ json: { session: branch } });
  });
  await page.route("**/api/sessions/branch/control", async (route) => {
    await route.fulfill({ json: { control: "running" } });
    applied.resolve();
  });
  await sessions.getByRole("link", { name: "History" }).click();
  await page.getByRole("button", { exact: true, name: "Fork" }).click();
  await page.getByRole("button", { name: "继续持续运行" }).click();
  try {
    await started.promise;
    await sessions.getByRole("link", { name: "Working" }).click();
    await browserExpect(page.locator(".cm-content")).toBeEditable();
  } finally {
    release.resolve();
  }
  await applied.promise;
  await settleLayout(page);
  await browserExpect(sessions.getByRole("link", { name: "Branch" })).toBeVisible();
  await browserExpect(page).toHaveURL(/#\/sessions\/working$/u);
  expect(fixture.errors).toEqual([]);
}, 30_000);
function queuedTranscript(content: string, transcriptRevision: number) {
  return {
    ...emptyTranscript,
    queue: [{ content, error: null, id: 1, status: "running", userMessageId: null }],
    transcriptRevision,
  };
}
