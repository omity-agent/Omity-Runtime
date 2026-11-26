import { expect, test } from "bun:test";

import { expect as browserExpect } from "playwright/test";

import { browserFixture } from "../scrolling/browserSession";
import {
  emitState,
  emptyTranscript,
  fixtureSessions,
  openPreparation,
  projectPaths,
  setPreparationLayout,
} from "./preparationBrowser";

const browser = browserFixture({
  "interaction.yaml": {
    recentSessions: fixtureSessions.length,
    recentWorkspaces: projectPaths.length,
  },
});
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
    await browserExpect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
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
    const updatedAt = Math.floor(Date.now() / 1000) - 120;
    await emitState(page, "session", { ...fixtureSessions[0]!, status: "idle", updatedAt });
    await browserExpect(running.getByRole("link", { name: /Working/u }).locator("time")).toHaveText(
      "2分钟前",
    );
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
test("compact layout keeps setup, navigation and message preview controls usable", async () => {
  const fixture = await openPreparation(browser);
  await using page = fixture.page;
  const workspace = page.getByRole("textbox", { name: "工作目录" }),
    profile = page.getByRole("combobox", { name: "Profile" }),
    toolbar = page.getByRole("banner"),
    credentials = toolbar.getByRole("link", { name: "管理通行密钥" }),
    create = toolbar.getByRole("link", { name: "新建会话" }),
    source = toolbar.getByRole("button", { name: "显示 Markdown 源码" }),
    recent = page.getByRole("button", { exact: true, name: projectPaths[0] }),
    next = page.getByRole("button", { exact: true, name: projectPaths[1] }),
    directory = await workspace.boundingBox(),
    configuration = await profile.boundingBox();
  expect(directory!.x + directory!.width).toBeLessThan(configuration!.x);
  expect((await next.boundingBox())!.x).toBeGreaterThan((await recent.boundingBox())!.x);
  await browserExpect(credentials).toBeVisible();
  await setPreparationLayout(page, "compact");
  await browserExpect(page.locator("aside")).toBeHidden();
  expect((await page.locator("main").boundingBox())!.y).toBe((await toolbar.boundingBox())!.height);
  await browserExpect(credentials).toBeVisible();
  await browserExpect(create).toBeVisible();
  await browserExpect(create).toBeDisabled();
  await browserExpect(source).toBeVisible();
  expect((await workspace.boundingBox())!.y).toBeLessThan((await profile.boundingBox())!.y);
  await page.getByRole("button", { exact: true, name: "会话列表" }).click();
  await browserExpect(credentials).toBeVisible();
  await browserExpect(create).toBeVisible();
  await browserExpect(source).toBeVisible();
  await page
    .getByRole("region", { exact: true, name: "项目" })
    .getByRole("button", { name: /atlas/u })
    .click();
  const history = page.getByRole("region", { name: "项目会话" });
  await browserExpect(history.getByRole("link")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const content = [
      '~~~svg\n<svg viewBox="0 0 20 20"><rect width="20" height="20" fill="#7ac"/></svg>\n~~~',
      "```mermaid\nflowchart TD\n  A --> B\n```",
    ].join("\n\n"),
    diagrams = page.getByRole("img", { name: /^(?:SVG|Mermaid) 图表$/u });
  await page.route("**/api/sessions/working/transcript", (route) =>
    route.fulfill({
      json: {
        ...emptyTranscript,
        messages: [
          {
            content,
            createdAt: 1,
            id: 1,
            images: [],
            inputId: null,
            reasoning: "",
            role: "assistant",
            toolCalls: [],
          },
        ],
      },
    }),
  );
  await history.getByRole("link", { name: "Working" }).click();
  await browserExpect(diagrams).toHaveCount(2, { timeout: 15_000 });
  await Promise.all(
    (await diagrams.all()).map(async (image) => {
      await image.evaluate((img: HTMLImageElement) => img.decode());
      await browserExpect(image).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }),
  );
  await page.keyboard.down("Control");
  await browserExpect(diagrams).toHaveCount(2);
  await page.keyboard.up("Control");
  await source.click();
  await browserExpect(source).toHaveAttribute("aria-pressed", "true");
  await browserExpect(page.locator("article pre")).toHaveText(content);
  await browserExpect(diagrams).toHaveCount(0);
  await source.click();
  await browserExpect(diagrams).toHaveCount(2);
  await create.click();
  await browserExpect(create).toBeDisabled();
  expect(fixture.errors).toEqual([]);
}, 30_000);
