import { afterAll, beforeAll, expect, test } from "bun:test";

import { expect as browserExpect } from "playwright/test";

import { BrowserSession } from "../scrolling/browserSession";
import { emitState, fixtureSessions, openPreparation, projectPaths } from "./preparationBrowser";

const browser = new BrowserSession();
beforeAll(() => browser.start(), 60_000);
afterAll(() => browser.stop());
test("changing profiles preserves manual Hook and MCP choices across differing defaults and missing options", async () => {
  const { errors, page } = await openPreparation(browser);
  try {
    const profile = page.getByRole("combobox", { exact: true, name: "Profile" }),
      hook = page.getByRole("switch", { exact: true, name: "shared-hook" }),
      optional = page.getByRole("switch", { exact: true, name: "optional-hook" }),
      server = page.getByRole("switch", { exact: true, name: "shared-server" });
    await hook.locator("..").click();
    await hook.locator("..").click();
    await optional.locator("..").click();
    await server.locator("..").click();
    await server.locator("..").click();
    await profile.selectOption("alternate");
    await browserExpect(page.getByRole("textbox", { exact: true, name: "模型" })).toHaveValue(
      "alternate-model",
    );
    await browserExpect(hook).toBeChecked();
    await browserExpect(optional).toBeChecked();
    await browserExpect(server).toBeChecked();
    await profile.selectOption("limited");
    await browserExpect(optional).toHaveCount(0);
    await profile.selectOption("");
    await browserExpect(optional).toBeChecked();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 30_000);
test("project browsing preserves running and stopped unread sessions until opened", async () => {
  const { errors, page } = await openPreparation(browser);
  try {
    const running = page.getByRole("region", { name: "近期" }),
      projects = page.getByRole("region", { exact: true, name: "项目" }),
      history = page.getByRole("region", { name: "项目会话" });
    await browserExpect(running.getByRole("link")).toHaveCount(2);
    expect(
      await page
        .locator("aside")
        .evaluate((element) =>
          [...element.querySelectorAll("*")]
            .filter((child) => ["auto", "scroll"].includes(getComputedStyle(child).overflowY))
            .map((child) => child.tagName),
        ),
    ).toEqual(["NAV"]);
    await projects.getByRole("button", { name: /atlas/u }).click();
    await browserExpect(history.getByRole("link")).toHaveCount(2);
    await projects.getByRole("button", { name: /beacon/u }).click();
    await browserExpect(history.getByRole("link")).toHaveCount(1);
    await emitState(page, "session", { ...fixtureSessions[0]!, status: "idle" });
    await browserExpect(running.getByRole("link", { name: /Working/u })).toBeVisible();
    await browserExpect(history.getByRole("link", { name: "Other" })).toBeVisible();
    await running.getByRole("link", { name: /Working/u }).click();
    await browserExpect(running.getByRole("link")).toHaveCount(1);
    await browserExpect(history.getByRole("link")).toHaveCount(2);
    await browserExpect(projects.getByRole("button", { name: /atlas/u })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 30_000);
test("setup adapts from side-by-side columns to a narrow screen with accessible project navigation", async () => {
  const { errors, page } = await openPreparation(browser);
  try {
    const workspace = page.getByRole("textbox", { name: "工作目录" }),
      profile = page.getByRole("combobox", { name: "Profile" }),
      recent = page.getByRole("button", { exact: true, name: projectPaths[0] }),
      next = page.getByRole("button", { exact: true, name: projectPaths[1] }),
      directory = await workspace.boundingBox(),
      configuration = await profile.boundingBox();
    expect(directory!.x + directory!.width).toBeLessThan(configuration!.x);
    expect((await recent.boundingBox())!.y).toBeLessThan((await next.boundingBox())!.y);
    await browserExpect(
      page.locator("aside footer").getByRole("link", { name: "管理通行密钥" }),
    ).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });
    expect((await workspace.boundingBox())!.y).toBeLessThan((await profile.boundingBox())!.y);
    await page.getByRole("button", { exact: true, name: "会话列表" }).click();
    await page
      .getByRole("region", { exact: true, name: "项目" })
      .getByRole("button", { name: /atlas/u })
      .click();
    await browserExpect(
      page.getByRole("region", { name: "项目会话" }).getByRole("link"),
    ).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 30_000);
