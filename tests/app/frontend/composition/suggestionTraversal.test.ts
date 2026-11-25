import { expect, test } from "bun:test";

import { expect as browserExpect } from "playwright/test";
import { z } from "zod";

import {
  messageSubmissionSchema,
  sessionSubmissionSchema,
} from "../../../../src/app/attachments/submission";
import { browserFixture } from "../scrolling/browserSession";
import { emitState, fixtureSessions, openPreparation } from "./preparationBrowser";

const browser = browserFixture(),
  messages = ["earlier question", "recent question"],
  predictions = ["next question", "another question"],
  draft = "unfinished current question";
test.each(["new", "session"])(
  "%s input traverses suggestions in both directions without saving previews",
  async (kind) => {
    const fixture = await openPreparation(browser, { messages, predictions }),
      { errors } = fixture;
    await using page = fixture.page;
    if (kind === "session") {
      await page.goto(`${page.url().split("#")[0]}#/sessions/history`);
    }
    const editor = page.locator(".cm-content");
    await browserExpect(editor).toBeEditable();
    await editor.press("ArrowUp");
    await browserExpect(editor).toHaveText(messages[1]!);
    await editor.press("ControlOrMeta+End");
    await editor.press("ArrowDown");
    await browserExpect(editor.locator(".cm-placeholder")).toBeVisible();
    await editor.fill(draft);
    const steps: [string, string][] = [
      ["ArrowUp", messages[1]!],
      ["ArrowUp", messages[0]!],
      ["ArrowUp", messages[0]!],
      ["ArrowDown", messages[1]!],
      ["ArrowDown", draft],
      ...(kind === "session"
        ? ([
            ["ArrowDown", predictions[0]!],
            ["ArrowDown", predictions[1]!],
            ["ArrowDown", predictions[1]!],
            ["ArrowUp", predictions[0]!],
            ["ArrowUp", draft],
          ] satisfies [string, string][])
        : []),
    ];
    for (const [key, text] of steps) {
      await editor.press(key === "ArrowUp" ? "ControlOrMeta+Home" : "ControlOrMeta+End");
      await editor.press(key);
      await browserExpect(editor).toHaveText(text);
    }
    await editor.press("ControlOrMeta+Home");
    await editor.press("ArrowUp");
    await page.evaluate(() => globalThis.dispatchEvent(new Event("pagehide")));
    await page.reload({ waitUntil: "networkidle" });
    await browserExpect(editor).toHaveText(draft);
    await editor.press("ControlOrMeta+End");
    await editor.press("ArrowDown");
    await editor.fill("edited selection");
    await editor.press("ControlOrMeta+Home");
    await editor.press("ArrowUp");
    await editor.press("ControlOrMeta+End");
    await editor.press("ArrowDown");
    await browserExpect(editor).toHaveText("edited selection");
    expect(errors).toEqual([]);
  },
  30_000,
);
test("arrows preserve multiline editing and selections away from document boundaries", async () => {
  const fixture = await openPreparation(browser, { messages, predictions }),
    { errors } = fixture;
  await using page = fixture.page;
  await page.goto(`${page.url().split("#")[0]}#/sessions/history`);
  const editor = page.locator(".cm-content"),
    multiline = "first line\nsecond line\nlast line";
  await browserExpect(editor).toBeEditable();
  await editor.fill(multiline);
  for (const keys of [
    ["ControlOrMeta+Home", "ArrowRight", "ArrowUp"],
    ["ControlOrMeta+Home", "ArrowDown"],
    ["ControlOrMeta+End", "ArrowLeft", "ArrowDown"],
    ["ControlOrMeta+A", "ArrowDown"],
    ["ControlOrMeta+A", "ArrowUp"],
  ]) {
    for (const key of keys) {
      await editor.press(key);
    }
    await browserExpect(editor).toHaveText(multiline.replaceAll("\n", ""));
  }
  await editor.press("ControlOrMeta+End");
  await editor.press("ArrowDown");
  await browserExpect(editor).toHaveText(predictions[0]!);
  await editor.press("ControlOrMeta+Home");
  await editor.press("ArrowUp");
  await browserExpect(editor).toHaveText(multiline.replaceAll("\n", ""));
  expect(errors).toEqual([]);
}, 30_000);
test.each(["new", "session"])(
  "%s submission sends the displayed candidate and clears browsing",
  async (kind) => {
    const fixture = await openPreparation(browser, { messages, predictions });
    await using page = fixture.page;
    if (kind === "session") {
      await page.goto(`${page.url().split("#")[0]}#/sessions/history`);
    }
    const editors = page.locator(".cm-content"),
      editor = editors.last(),
      submitted: unknown[] = [],
      candidate = kind === "session" ? predictions[0]! : messages[1]!;
    await browserExpect(editor).toBeEditable();
    if (kind === "new") {
      await page.getByRole("button", { name: "增加消息对" }).click();
      await editors.nth(0).press("ArrowUp");
      await editors.nth(0).press("ArrowUp");
      await editors.nth(1).press("ArrowUp");
      await browserExpect(editors.nth(0)).toHaveText(messages[0]!);
      await browserExpect(editors.nth(1)).toHaveText(messages[1]!);
    }
    await editor.fill(draft);
    await editor.press(kind === "session" ? "ControlOrMeta+End" : "ControlOrMeta+Home");
    await editor.press(kind === "session" ? "ArrowDown" : "ArrowUp");
    await browserExpect(editor).toHaveText(candidate);
    await page.route(
      kind === "session" ? "**/api/sessions/history/messages" : "**/api/sessions",
      async (route) => {
        const request = route.request(),
          form = await new Response(new Uint8Array(request.postDataBuffer() ?? []), {
            headers: request.headers(),
          }).formData(),
          value: unknown = JSON.parse(z.string().parse(form.get("submission")));
        submitted.push(
          kind === "session"
            ? messageSubmissionSchema.parse(value).content
            : sessionSubmissionSchema.parse(value),
        );
        await route.fulfill({
          json:
            kind === "session"
              ? { content: candidate, inputId: 1 }
              : { session: fixtureSessions[1] },
        });
      },
    );
    await editor.press("ControlOrMeta+Enter");
    await browserExpect
      .poll(() => submitted)
      .toMatchObject(
        kind === "session"
          ? [candidate]
          : [{ history: [{ assistant: messages[1], user: messages[0] }], message: candidate }],
      );
    await browserExpect(page.locator(".cm-content .cm-placeholder")).toBeVisible();
    expect(fixture.errors).toEqual([]);
  },
  30_000,
);
test("prediction refresh restores the draft before browsing replacement candidates", async () => {
  const suggestions = { messages, predictions: [...predictions] },
    fixture = await openPreparation(browser, suggestions);
  await using page = fixture.page;
  await page.goto(`${page.url().split("#")[0]}#/sessions/history`);
  const editor = page.locator(".cm-content");
  await browserExpect(editor).toBeEditable();
  await editor.fill(draft);
  await editor.press("ArrowDown");
  await browserExpect(editor).toHaveText(predictions[0]!);
  suggestions.predictions = ["replacement prediction"];
  await emitState(page, "session", fixtureSessions[1]!);
  await browserExpect(editor).toHaveText(draft);
  await editor.press("ControlOrMeta+End");
  await editor.press("ArrowDown");
  await browserExpect(editor).toHaveText(suggestions.predictions[0]!);
  expect(fixture.errors).toEqual([]);
}, 30_000);
