import { beforeAll, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { FileLinkProvider } from "../../../../src/app/frontend/components/FileLink/context";
import { MarkdownView } from "../../../../src/app/frontend/components/Markdown";
import { i18nReady } from "../../../../src/app/frontend/i18n";
import { elementAttributes } from "../elementAttributes";

const linkCases = ["“src/demo(1).ts”", "`src/demo(1).ts`"].map((text) => {
  const path = "src/demo(1).ts",
    content = `前言\r\n前文**${text}**后文`,
    start = content.indexOf(path),
    matches = [{ kind: "file" as const, path, position: { end: start + path.length, start } }];
  return [text, path, content, matches] as const;
});
beforeAll(async () => {
  await i18nReady;
});
test.each(linkCases)(
  "keeps file-link offsets inside emphasized %s after newline normalization",
  async (_text, path, content, matches) => {
    const markup = renderToStaticMarkup(
        <FileLinkProvider sessionId="modifier-boundaries">
          <MarkdownView content={content} fileLinks={matches} />
        </FileLinkProvider>,
      ),
      links = await elementAttributes(markup, "strong button[title]");
    expect(links.map((link) => link["title"])).toEqual([path]);
  },
);
const linkedPath = "src/example.ts",
  linkedContent = `公式 $x^2$ 后查看 ${linkedPath}\n\n| 项目 | 公式 |\n| --- | --- |\n| **值** | $y_1$ |`,
  linkedStart = linkedContent.indexOf(linkedPath),
  formulaLinks = [
    {
      kind: "file" as const,
      path: linkedPath,
      position: { end: linkedStart + linkedPath.length, start: linkedStart },
    },
  ];
test("keeps file-link offsets and GFM formatting alongside formulas", () => {
  const markup = renderToStaticMarkup(
    <FileLinkProvider sessionId="math-rendering">
      <MarkdownView content={linkedContent} fileLinks={formulaLinks} preserveLineBreaks />
    </FileLinkProvider>,
  );
  expect(markup.match(/class="katex"/gu)).toHaveLength(2);
  expect(markup).toContain(`title="${linkedPath}"`);
  expect(markup).toMatch(/<table\b/u);
  expect(markup).toContain("<strong>值</strong>");
});
