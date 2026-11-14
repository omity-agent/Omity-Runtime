import type { Page } from "playwright";

import { composerDraftBody } from "../../../../src/app/contracts/commands";
import type { SessionInfo } from "../../../../src/app/events/contracts";
import type { BrowserSession } from "../scrolling/browserSession";

export const projectPaths = ["/projects/atlas", "/projects/beacon"];
const working: SessionInfo = {
  createdAt: 1,
  error: null,
  id: "working",
  status: "streaming",
  title: "Working",
  updatedAt: 3,
  workspace: projectPaths[0]!,
};
export const fixtureSessions: SessionInfo[] = [
  working,
  { ...working, id: "history", status: "idle", title: "History" },
  { ...working, id: "other", title: "Other", workspace: projectPaths[1]! },
];
export async function emitState(
  page: Page,
  name: "session" | "restore",
  value: SessionInfo | { sessions: SessionInfo[] },
) {
  await page.evaluate(
    ({ data, type }) => {
      globalThis.dispatchEvent(
        new MessageEvent(type, {
          data,
          lastEventId: `${crypto.randomUUID()}:1`,
        }),
      );
    },
    { data: JSON.stringify(value), type: name },
  );
}
export async function openPreparation(
  browser: BrowserSession,
  suggestions: { messages?: string[]; predictions?: string[] } = {},
) {
  let draft: { content: string | null; revision: number } = { content: null, revision: 0 },
    composer: typeof draft = { content: null, revision: 0 };
  const errors: string[] = [],
    page = await browser.openFixture(
      "/tests/app/frontend/composition/applicationShell.html",
      async (fixture) => {
        fixture.on("pageerror", (error) => errors.push(error.message));
        await fixture.addInitScript(() => {
          Object.defineProperty(globalThis, "EventSource", {
            value: class extends EventTarget {
              constructor(url: string) {
                super();
                if (url.endsWith("/state")) {
                  this.addEventListener = globalThis.addEventListener.bind(globalThis);
                }
              }
              close() {}
            },
          });
        });
        await fixture.route("**/api/**", (route) => {
          const url = new URL(route.request().url()),
            path = url.pathname
              .slice(url.pathname.indexOf("/api/"))
              .replace(/\/sessions\/[^/]+/u, "/sessions/:id"),
            alternate = url.searchParams.has("profile"),
            responses: Record<string, unknown> = {
              "/api/access": {
                authenticated: true,
                configured: true,
                credentialCount: 1,
                local: true,
                publicOrigin: "https://example.com",
              },
              "/api/bootstrap": {
                attachments: { allowedSuffixes: [".txt"], maxSizeBytes: 1024 },
                cwd: projectPaths[0],
                frontend: {
                  cacheHitWarningRatio: 0.9,
                  draftSaveDelayMs: 500,
                  reasoningTranslation: {
                    enabled: false,
                    highConfidenceThreshold: 0.8,
                    minimumIntervalMs: 0,
                  },
                  transcriptSnapshotThrottleMs: 250,
                },
                profiles: { available: ["alternate", "limited"] },
                sessions: fixtureSessions,
              },
              "/api/session-options": {
                hooks: [
                  { enable: !alternate, id: "shared-hook" },
                  ...(url.searchParams.get("profile") === "limited"
                    ? []
                    : [{ enable: false, id: "optional-hook" }]),
                ],
                mcpServers: [{ enable: !alternate, id: "shared-server" }],
                model: alternate ? "alternate-model" : "default-model",
              },
              "/api/session-preparation": draft,
              "/api/sessions/:id/composer-draft": composer,
              "/api/sessions/:id/predictions": { predictions: suggestions.predictions ?? [] },
              "/api/sessions/:id/transcript": {
                control: "running",
                eventCursor: 0,
                events: [],
                fileLinks: [],
                messages: [],
                queue: [],
                reasoningTranslations: [],
                transcriptRevision: 0,
              },
              "/api/user-messages": {
                messages: (suggestions.messages ?? []).map((content, createdAt) => ({
                  content,
                  createdAt,
                })),
              },
            },
            json = responses[path];
          if (path === "/api/session-preparation" && route.request().method() !== "GET") {
            const next = composerDraftBody.parse(route.request().postDataJSON());
            if (next.revision > draft.revision) {
              draft = next;
            }
            return route.fulfill({ json: { revision: draft.revision } });
          }
          if (path.endsWith("/composer-draft") && route.request().method() !== "GET") {
            composer = composerDraftBody.parse(route.request().postDataJSON());
            return route.fulfill({ json: { revision: composer.revision } });
          }
          if (json === undefined) {
            errors.push(`Unexpected API request: ${path}`);
            return route.fulfill({ body: path, status: 500 });
          }
          return route.fulfill({ json });
        });
      },
    );
  await page.locator('input[name="model"]').waitFor();
  await emitState(page, "restore", { sessions: fixtureSessions });
  return { errors, page };
}
