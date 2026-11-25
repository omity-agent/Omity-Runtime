import { join, resolve } from "node:path";

import { type Browser, chromium } from "playwright";
import { createServer } from "vite";
import { parse } from "yaml";
import { z } from "zod";

import conversation from "../../../locales/interface/conversation.zh-CN.json" with { type: "json" };
import credentials from "../../../locales/interface/credentials.zh-CN.json" with { type: "json" };
import preparation from "../../../locales/interface/preparation.zh-CN.json" with { type: "json" };
import { forkPage, pagePath, sessionPage } from "../../../src/app/frontend/route";
import { localize } from "../../../src/i18n/server";
import viteConfig from "../../../vite.config";
import {
  firstReplyTitle,
  forkMessageId,
  lastReplyTitle,
  waitForAlertContent,
} from "./alertScenario";
import { sampleSessionId, serveSamples } from "./fixtures";
import { applyScreenshotFont } from "./typography";

const screenSchema = z.strictObject({
    height: z.int().positive(),
    touch: z.boolean(),
    width: z.int().positive(),
  }),
  settingsSchema = z.strictObject({
    browserChannel: z.string().min(1).optional(),
    chineseFont: z.string().trim().min(1),
    screens: z
      .record(z.string().regex(/^[a-z][a-z0-9-]*$/u), screenSchema)
      .refine(
        (screens) => Object.keys(screens).length > 0,
        localize("build:screenshots.emptyScreens"),
      ),
  });
type Screen = z.infer<typeof screenSchema>;
interface Scene {
  name: string;
  path: string;
  readyButton: string;
  heading?: string;
  requiresVerification?: boolean;
}
const scenes: Scene[] = [
    {
      name: "new-session",
      path: pagePath({ kind: "new" }),
      readyButton: preparation.createAndSend,
    },
    {
      heading: lastReplyTitle,
      name: "session",
      path: pagePath(sessionPage(sampleSessionId)),
      readyButton: conversation.send,
    },
    {
      heading: firstReplyTitle,
      name: "fork",
      path: pagePath(forkPage(sampleSessionId, forkMessageId)),
      readyButton: conversation.send,
    },
    {
      heading: credentials.loginTitle,
      name: "access",
      path: "",
      readyButton: credentials.verify,
      requiresVerification: true,
    },
  ],
  root = resolve(import.meta.dir, "../../.."),
  directory = join(root, "dist", "screenshots"),
  host = "127.0.0.1",
  { browserChannel, chineseFont, screens } = settingsSchema.parse(
    parse(await Bun.file(join(root, "settings", "screenshots.yaml")).text()),
  );

await using resources = new AsyncDisposableStack();
const server = await createServer({
  ...viteConfig,
  cacheDir: join(root, "node_modules", ".cache", "screenshots-vite"),
  configFile: false,
  envDir: false,
  logLevel: "warn",
  optimizeDeps: { rolldownOptions: { checks: { bundlerTimings: false } } },
  server: { hmr: false, host, port: 0, strictPort: true, watch: null },
});
resources.defer(() => server.close());
await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") {
  throw new Error(localize("build:screenshots.noServerAddress"));
}
const origin = `http://${host}:${address.port.toString()}`;
await using chromiumBrowser = await chromium.launch({
  channel: browserChannel,
  ignoreDefaultArgs: ["--hide-scrollbars"],
});

for (const [screenName, screen] of Object.entries(screens)) {
  for (const scene of scenes) {
    await capture(chromiumBrowser, scene, screenName, screen);
  }
}
console.log(
  localize("build:screenshots.saved", {
    count: scenes.length * Object.keys(screens).length,
    directory,
  }),
);

async function capture(
  browser: Browser,
  scene: Scene,
  screenName: string,
  { height, touch, width }: Screen,
) {
  await using page = await browser.newPage({
    hasTouch: touch,
    isMobile: touch,
    locale: "zh-CN",
    serviceWorkers: "block",
    timezoneId: "UTC",
    viewport: { height, width },
  });
  const failures: Error[] = [],
    failureMessage = localize("build:screenshots.renderFailed", {
      page: scene.name,
      screen: screenName,
    });
  page.on("pageerror", (error) => failures.push(error));
  page.on("console", (event) => {
    if (event.type() === "error") {
      failures.push(new Error(event.text()));
    }
  });
  let png: Buffer;
  try {
    await serveSamples(page, origin, !scene.requiresVerification, failures);
    await page.goto(`${origin}/${scene.path}`);
    await applyScreenshotFont(page, chineseFont);
    await page
      .getByRole("button", { exact: true, name: scene.readyButton })
      .and(page.locator(":enabled"))
      .waitFor();
    if (scene.heading) {
      await page.getByRole("heading", { exact: true, name: scene.heading }).waitFor();
    }
    if (scene.name === "session" || scene.name === "fork") {
      await waitForAlertContent(page, scene.name === "session");
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
    });
    png = await page.screenshot({
      animations: "disabled",
      caret: "hide",
      scale: "css",
      type: "png",
    });
  } catch (error) {
    throw new AggregateError(failures, failureMessage, { cause: error });
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, failureMessage);
  }
  await Bun.write(join(directory, scene.name, `${screenName}.png`), png, { createPath: true });
}
