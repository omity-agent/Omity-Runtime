import { afterAll, beforeAll } from "bun:test";
import { resolve as resolvePath } from "node:path";

import { type Browser, chromium, type Page } from "playwright";
import { createServer } from "vite";

import {
  createYamlAssets,
  type YamlAssetOverrides,
  yamlAssets,
} from "../../../../scripts/yamlAssets";
import viteConfig from "../../../../vite.config";
import {
  fixtureDependencies,
  fixtureServer,
  regressionViewport,
  scrollingBrowser,
} from "../../../support/browserOptions";

export class BrowserSession {
  private readonly resources = new AsyncDisposableStack();
  private browser?: Browser;
  private origin?: string;
  constructor(private readonly overrides?: YamlAssetOverrides) {}
  async start() {
    const server = await createServer({
      ...viteConfig,
      cacheDir: resolvePath("node_modules/.cache/scrolling-vite"),
      configFile: false,
      logLevel: "error",
      optimizeDeps: fixtureDependencies,
      plugins: viteConfig.plugins?.map((plugin) =>
        plugin === yamlAssets && this.overrides ? createYamlAssets(this.overrides) : plugin,
      ),
      root: resolvePath(import.meta.dir, "../../../.."),
      server: fixtureServer,
    });
    this.resources.defer(() => server.close());
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Scrolling fixture server has no TCP address");
    }
    this.origin = `http://${fixtureServer.host}:${address.port.toString()}`;
    const browser = await chromium.launch({
      ...scrollingBrowser,
      channel: process.env["OMITY_TEST_BROWSER_CHANNEL"],
    });
    this.resources.defer(() => browser.close());
    this.browser = browser;
  }
  async open(mode: string) {
    const page = await this.openFixture(
      `/tests/app/frontend/scrolling/streamingPage.html?mode=${mode}`,
    );
    await page.waitForFunction(
      () => Object.hasOwn(globalThis, "scrolling") && document.querySelectorAll("pre").length === 3,
    );
    await settleLayout(page);
    return page;
  }
  async openFixture(path: string, setup?: (page: Page) => Promise<void>) {
    if (!this.browser || !this.origin) {
      throw new Error("Browser fixture session has not started");
    }
    await using cleanup = new AsyncDisposableStack();
    const page = cleanup.use(
      await this.browser.newPage({ locale: "en-US", viewport: regressionViewport }),
    );
    await setup?.(page);
    await page.goto(`${this.origin}${path}`, { waitUntil: "networkidle" });
    cleanup.move();
    return page;
  }
  stop() {
    return this.resources.disposeAsync();
  }
}
export function browserFixture(overrides?: YamlAssetOverrides) {
  const session = new BrowserSession(overrides);
  beforeAll(() => session.start(), 60_000);
  afterAll(() => session.stop());
  return session;
}
export async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    let remaining = 4;
    const frame = () => {
      remaining -= 1;
      if (remaining === 0) {
        resolve();
      } else {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
    await promise;
  });
}
export async function readScrollPositions(page: Page, expectedCount?: number) {
  const snapshot = await page.waitForFunction((count) => {
    const elements = [...document.querySelectorAll("#root > section, pre")];
    if (count !== undefined && elements.length !== count) {
      return undefined;
    }
    return elements.map((element) => ({
      gap: element.scrollHeight - element.clientHeight - element.scrollTop,
      tag: element.tagName,
      top: element.scrollTop,
    }));
  }, expectedCount);
  try {
    return (await snapshot.jsonValue())!;
  } finally {
    await snapshot.dispose();
  }
}
