import { afterAll, beforeAll, expect, test } from "bun:test";

import { expect as browserExpect } from "playwright/test";

import { BrowserSession } from "../scrolling/browserSession";
import {
  emitState,
  fixtureSessions,
  openPreparation,
  projectPaths,
  setPreparationLayout,
} from "./preparationBrowser";

const browser = new BrowserSession({
  "interaction.yaml": {
    recentSessions: fixtureSessions.length,
    recentWorkspaces: projectPaths.length,
  },
});
beforeAll(() => browser.start(), 60_000);
afterAll(() => browser.stop());
test.each(["wide", "compact"] as const)(
  "project selection stays independent of recent sessions in %s layout",
  async (layout) => {
    const fixture = await openPreparation(browser);
    await using page = fixture.page;
    await setPreparationLayout(page, layout);
    const showSessions = async () => {
      if (layout === "compact") {
        await page.getByRole("button", { exact: true, name: "会话列表" }).click();
      }
    };
    await showSessions();
    const running = page.getByRole("region", { name: "近期" }),
      projects = page.getByRole("region", { exact: true, name: "项目" }),
      history = page.getByRole("region", { name: "项目会话" }),
      selectedProject = projects.locator('button[aria-pressed="true"]');
    await browserExpect(running.getByRole("link")).toHaveCount(3);
    expect(
      await page
        .locator("aside")
        .evaluate((element) =>
          [...element.querySelectorAll("*")]
            .filter((child) => ["auto", "scroll"].includes(getComputedStyle(child).overflowY))
            .map((child) => child.tagName),
        ),
    ).toEqual(["NAV"]);
    await browserExpect(selectedProject).toHaveAttribute("title", projectPaths[0]!);
    await running.getByRole("link", { name: "Other" }).click();
    await browserExpect(page).toHaveURL(/#\/sessions\/other$/u);
    await showSessions();
    await browserExpect(history.getByRole("link")).toHaveCount(2);
    await browserExpect(selectedProject).toHaveAttribute("title", projectPaths[0]!);
    await projects.getByRole("button", { name: /beacon/u }).click();
    await browserExpect(history.getByRole("link")).toHaveCount(1);
    await emitState(page, "session", { ...fixtureSessions[0]!, status: "idle" });
    await browserExpect(running.getByRole("link", { name: /Working/u })).toBeVisible();
    await browserExpect(history.getByRole("link", { name: "Other" })).toBeVisible();
    await running.getByRole("link", { name: /Working/u }).click();
    await browserExpect(page).toHaveURL(/#\/sessions\/working$/u);
    await showSessions();
    await browserExpect(running.getByRole("link")).toHaveCount(3);
    await browserExpect(history.getByRole("link", { name: "Other" })).toBeVisible();
    await browserExpect(selectedProject).toHaveAttribute("title", projectPaths[1]!);
    await history.getByRole("link", { name: "Other" }).click();
    await browserExpect(page).toHaveURL(/#\/sessions\/other$/u);
    await showSessions();
    await browserExpect(history.getByRole("link", { name: "Other" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await emitState(page, "session", { ...fixtureSessions[0]!, createdAt: 10 });
    await browserExpect(projects.getByRole("button").first()).toHaveAttribute(
      "title",
      projectPaths[0]!,
    );
    await browserExpect(selectedProject).toHaveAttribute("title", projectPaths[1]!);
    await page.reload({ waitUntil: "networkidle" });
    await showSessions();
    await browserExpect(selectedProject).toHaveAttribute("title", projectPaths[1]!);
    await emitState(page, "restore", { sessions: fixtureSessions.slice(0, 2) });
    await browserExpect(page).toHaveURL(/#\/new$/u);
    await showSessions();
    await browserExpect(projects.getByRole("button")).toHaveCount(1);
    await browserExpect(selectedProject).toHaveAttribute("title", projectPaths[0]!);
    await browserExpect(history.getByRole("link")).toHaveCount(2);
    expect(fixture.errors).toEqual([]);
  },
  30_000,
);
test("setup adapts from side-by-side columns to a narrow screen with accessible project navigation", async () => {
  const fixture = await openPreparation(browser);
  await using page = fixture.page;
  const workspace = page.getByRole("textbox", { name: "工作目录" }),
    profile = page.getByRole("combobox", { name: "Profile" }),
    recent = page.getByRole("button", { exact: true, name: projectPaths[0] }),
    next = page.getByRole("button", { exact: true, name: projectPaths[1] }),
    directory = await workspace.boundingBox(),
    configuration = await profile.boundingBox();
  expect(directory!.x + directory!.width).toBeLessThan(configuration!.x);
  expect((await recent.boundingBox())!.y).toBeLessThan((await next.boundingBox())!.y);
  await browserExpect(
    page.locator("aside header").getByRole("link", { name: "管理通行密钥" }),
  ).toBeVisible();
  await setPreparationLayout(page, "compact");
  expect((await workspace.boundingBox())!.y).toBeLessThan((await profile.boundingBox())!.y);
  await page.getByRole("button", { exact: true, name: "会话列表" }).click();
  await page
    .getByRole("region", { exact: true, name: "项目" })
    .getByRole("button", { name: /atlas/u })
    .click();
  await browserExpect(page.getByRole("region", { name: "项目会话" }).getByRole("link")).toHaveCount(
    2,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(fixture.errors).toEqual([]);
}, 30_000);
