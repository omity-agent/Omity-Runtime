import type { Page } from "playwright";
import { parse } from "yaml";

import type { SessionPreparation } from "../../../src/app/composition/preparation";
import type { AccessStatus } from "../../../src/app/contracts/authentication";
import { bootstrapResponseSchema, type SessionOptions } from "../../../src/app/contracts/results";
import type { SessionInfo } from "../../../src/app/events/contracts";
import { localize } from "../../../src/i18n/server";
import { observedAt, transcript } from "./alertScenario";

export const sampleSessionId = "exposure-alert";

const workspace = "/projects/observatory",
  session: SessionInfo = {
    createdAt: observedAt,
    error: null,
    id: sampleSessionId,
    profile: "review",
    status: "idle",
    stepAvailable: false,
    title: "观测曝光告警",
    updatedAt: observedAt + 600,
    workspace,
  },
  sessions: SessionInfo[] = [
    session,
    {
      ...session,
      id: "station-log",
      status: "streaming",
      title: "同步测站日志",
      updatedAt: observedAt + 300,
    },
    {
      ...session,
      id: "field-notes",
      status: "paused",
      title: "更新采集手册",
      workspace: "/projects/field-notes",
    },
  ],
  defaults = bootstrapResponseSchema
    .pick({ attachments: true, frontend: true })
    .parse(
      parse(
        await Bun.file(new URL("../../../settings/defaults/main.yaml", import.meta.url)).text(),
      ),
    ),
  bootstrap = {
    ...defaults,
    cwd: workspace,
    frontend: {
      ...defaults.frontend,
      reasoningTranslation: { ...defaults.frontend.reasoningTranslation, enabled: false },
    },
    profiles: { available: ["review", "writing"] },
    sessions,
  },
  preparation: SessionPreparation = {
    message: "读取昨晚的导星帧，判断哪些帧的曝光超过了饱和阈值。",
    pairs: [],
    workspace,
  },
  options: SessionOptions = {
    builtInTools: [
      { enable: true, id: "choice", name: "ask_choices" },
      { enable: true, id: "open_ended", name: "ask_open_ended" },
    ],
    hooks: [{ enable: false, id: "export-report" }],
    mcpServers: [{ enable: true, id: "observatory" }],
    model: "example-model",
    prompts: [
      { enable: true, id: "base.md" },
      { enable: true, id: "skills.md" },
    ],
    skills: [
      { description: "整理测站的观测记录。", enable: false, id: "observation-log" },
      { description: "检查图像的曝光与饱和度。", enable: false, id: "exposure-review" },
    ],
  };

export function serveSamples(
  page: Page,
  origin: string,
  authenticated: boolean,
  failures: Error[],
) {
  const access: AccessStatus = {
      authenticated,
      configured: true,
      credentialCount: 1,
      local: authenticated,
      publicOrigin: "https://omity.example",
    },
    sessionApi = `/api/sessions/${sampleSessionId}`,
    responses = new Map<string, unknown>([
      ["/api/access", access],
      ["/api/bootstrap", bootstrap],
      ["/api/session-options", options],
      ["/api/session-preparation", { content: JSON.stringify(preparation), revision: 0 }],
      [
        "/api/user-messages",
        { messages: [{ content: preparation.message, createdAt: observedAt }] },
      ],
      [`${sessionApi}/composer-draft`, { content: "改成连续三帧超限才告警。", revision: 0 }],
      [`${sessionApi}/predictions`, { predictions: [] }],
      [`${sessionApi}/transcript`, transcript],
    ]);
  return page.route("**/*", (route) => {
    const request = route.request(),
      { href, origin: requestOrigin, pathname } = new URL(request.url()),
      method = request.method();
    if (requestOrigin !== origin) {
      failures.push(new Error(localize("build:screenshots.externalRequest", { url: href })));
      return route.abort();
    }
    if (!pathname.startsWith("/api/")) {
      return route.continue();
    }
    if (method === "GET") {
      if (pathname === "/api/events/state" || pathname === `${sessionApi}/events/content`) {
        return route.fulfill({ status: 204 });
      }
      if (responses.has(pathname)) {
        return route.fulfill({ json: responses.get(pathname) });
      }
    }
    const error = localize("build:screenshots.unexpectedApi", { method, path: pathname });
    failures.push(new Error(error));
    return route.fulfill({
      json: { error: { code: "SAMPLE_UNAVAILABLE", message: error } },
      status: 501,
    });
  });
}
