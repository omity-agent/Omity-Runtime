import { afterAll, expect, test } from "bun:test";

import { createCodeHighlighter } from "../../../../src/app/frontend/components/HighlightedCode/background/tokenization";
import type { FilePathMatch } from "../../../../src/fileLinks/types";
import { browserFixture, settleLayout } from "./browserSession";

const session = browserFixture(),
  paths = [
    String.raw`crates\protocol\src\archive\measure.rs`,
    String.raw`crates\frontend\build_support\emission.rs`,
    String.raw`crates\frontend\build_support\records.rs`,
    String.raw`crates\frontend\build_support\variants.rs`,
  ],
  command = `command: Get-Content -LiteralPath ${paths.join(", ")} -Raw`,
  highlighter = createCodeHighlighter();
afterAll(() => highlighter.release("linked-punctuation"));
test("linked code preserves punctuation through streaming and syntax retokenization", async () => {
  await using page = await session.open("append");
  const diagnostics: string[] = [];
  page.on("pageerror", (error) => diagnostics.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      diagnostics.push(message.text());
    }
  });
  await page.addScriptTag({
    type: "module",
    url: "/tests/app/frontend/scrolling/punctuationHarness.tsx",
  });
  await page.waitForFunction(() => Object.hasOwn(globalThis, "renderLinkedFrame"));
  for (let revision = 0; revision < 12; revision += 1) {
    const code = command + " ".repeat(revision),
      language = revision % 2 === 0 ? "yaml" : "powershell",
      matches: FilePathMatch[] = paths.map((path) => {
        const start = code.indexOf(path);
        return {
          kind: "file",
          path,
          position: { end: start + path.length, start },
        };
      }),
      result = await highlighter.highlight({
        code,
        language,
        streamId: "linked-punctuation",
      });
    for (const html of [undefined, result.lines[0]]) {
      await page.evaluate((frame) => globalThis.window.renderLinkedFrame(frame), {
        code,
        html,
        language,
        matches,
      });
      await settleLayout(page);
      for (const selector of ["[data-controlled-line]", "[data-streamed-code] code"]) {
        const rendered = page.locator(selector);
        expect(await rendered.textContent()).toBe(code);
        expect(await rendered.locator("button").allTextContents()).toEqual(paths);
      }
    }
  }
  expect(diagnostics).toEqual([]);
}, 30_000);

test("file path underlines follow each syntax fragment's text color", async () => {
  await using page = await session.open("append");
  const path = "src/feature.ts",
    html =
      '<span style="color: var(--colors-syntax-string)">src/</span>' +
      '<span style="color: var(--colors-syntax-keyword)">feature.ts</span>';
  await page.addScriptTag({
    type: "module",
    url: "/tests/app/frontend/scrolling/punctuationHarness.tsx",
  });
  await page.waitForFunction(() => Object.hasOwn(globalThis, "renderLinkedFrame"));
  await page.evaluate((frame) => globalThis.window.renderLinkedFrame(frame), {
    code: path,
    html,
    language: "plaintext",
    matches: [{ kind: "file" as const, path, position: { end: path.length, start: 0 } }],
  });
  await settleLayout(page);
  const fragments = await page.locator("[data-controlled-line] button").evaluate((button) =>
    [...button.querySelectorAll("span")]
      .filter((element) => element.children.length === 0 && element.textContent)
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.color,
          decoration: style.textDecorationLine,
          underline: style.textDecorationColor,
        };
      }),
  );
  expect(fragments).toHaveLength(2);
  expect(new Set(fragments.map(({ color }) => color)).size).toBe(2);
  for (const fragment of fragments) {
    expect(fragment.decoration).toContain("underline");
    expect(fragment.underline).toBe(fragment.color);
  }
}, 30_000);
