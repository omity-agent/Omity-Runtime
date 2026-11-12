import { afterAll, beforeAll, expect, test } from "bun:test";

import { BrowserSession, settleLayout } from "../scrolling/browserSession";
import { openPreparation } from "./preparationBrowser";

const browser = new BrowserSession();
beforeAll(() => browser.start(), 60_000);
afterAll(() => browser.stop());
test("message selections remain visible through the active line background", async () => {
  const { errors, page } = await openPreparation(browser);
  await using _pageScope = page;
  const editor = page.locator(".cm-content").first(),
    text = "Select this message without hiding its highlight.";
  await editor.fill(text);
  await editor.press("ControlOrMeta+A");
  await page.locator(".cm-selectionBackground").first().waitFor();
  await settleLayout(page);
  const selection = await page.evaluate(() => {
    const activeLine = document.querySelector(".cm-activeLine"),
      highlight = document.querySelector(".cm-selectionBackground"),
      canvas = document.createElement("canvas"),
      context = canvas.getContext("2d"),
      reference = document.createElement("span");
    if (!activeLine || !highlight || !context) {
      throw new Error("The editor must render its active line and selection");
    }
    canvas.height = 1;
    canvas.width = 1;
    reference.style.backgroundColor = "var(--colors-bg-selection)";
    reference.style.display = "none";
    document.body.append(reference);
    const expectedColor = getComputedStyle(reference).backgroundColor;
    reference.remove();
    const alpha = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[3]! / 255;
      },
      activeBackground = getComputedStyle(activeLine).backgroundColor,
      selectionBackground = getComputedStyle(highlight).backgroundColor;
    return {
      activeAlpha: alpha(activeBackground),
      expectedColor,
      selectionAlpha: alpha(selectionBackground),
      selectionColor: selectionBackground,
      text: globalThis.getSelection()?.toString(),
    };
  });
  expect(selection.text).toBe(text);
  expect(selection.selectionAlpha).toBeGreaterThan(0);
  expect(selection.activeAlpha).toBeLessThan(1);
  expect(selection.selectionColor).toBe(selection.expectedColor);
  expect(errors).toEqual([]);
}, 30_000);
