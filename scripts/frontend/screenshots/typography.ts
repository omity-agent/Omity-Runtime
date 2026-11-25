import type { Page } from "playwright";

import { localize } from "../../../src/i18n/server";

export async function applyScreenshotFont(page: Page, fontName: string) {
  try {
    await page.evaluate(async (name) => {
      const family = "OmityScreenshotChinese",
        font = new FontFace(family, `local(${CSS.escape(name)})`, {
          unicodeRange: [
            "U+3000-303F",
            "U+31C0-31EF",
            "U+3400-4DBF",
            "U+4E00-9FFF",
            "U+F900-FAFF",
            "U+FE30-FE4F",
            "U+FF00-FFEF",
            "U+20000-323AF",
          ].join(", "),
          weight: "250 900",
        }),
        root = document.documentElement,
        computed = getComputedStyle(root),
        editor = document.createElement("style");
      document.fonts.add(await font.load());
      for (const token of ["--fonts-body", "--fonts-mono"]) {
        root.style.setProperty(token, `${family}, ${computed.getPropertyValue(token)}`);
      }
      editor.textContent = `:root .cm-editor > .cm-scroller { font-family: ${family}, monospace; }`;
      document.head.append(editor);
    }, fontName);
  } catch (error) {
    throw new Error(localize("build:screenshots.fontUnavailable", { font: fontName }), {
      cause: error,
    });
  }
}
