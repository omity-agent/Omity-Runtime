import type { Page } from "playwright";

import { localize } from "../../../src/app/frontend/i18n";
import type {
  DisplayMessage,
  TranscriptSnapshot,
} from "../../../src/app/timeline/contracts/records";

export const observedAt = Date.UTC(2024, 10, 25, 9) / 1000;
export const forkMessageId = 4;
export const firstReplyTitle = "饱和判据";
export const lastReplyTitle = "告警流程";

const toolName = "read_exposure_stats",
  callId = "exposure-sample",
  fullScale = 4095,
  limit = 0.85,
  counts = [2620, 2840, 3080, 3330, 3630, 3160],
  peak = Math.max(...counts),
  observedPercent = ((100 * peak) / fullScale).toFixed(1),
  trace = counts
    .map(
      (count, i) =>
        `${(44 + i * 40).toString()},${(80 - (count / fullScale - 0.6) * 160).toFixed(1)}`,
    )
    .join(" "),
  reply = [
    `### ${firstReplyTitle}`,
    String.raw`$$
r = \frac{p_{\max}}{p_{\mathrm{full}}} = \frac{${peak}}{${fullScale}} \approx ${observedPercent}\%
$$`,
    "第 5 帧越过 85% 阈值。",
    `~~~svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 268 104">
  <path fill="none" stroke="#64748b" d="M44 16V80H252"/>
  <path stroke="#b45309" stroke-dasharray="4 3" d="M44 40H252"/>
  <polyline points="${trace}" fill="none" stroke="#0369a1" stroke-width="2.5"
    stroke-linecap="round" stroke-linejoin="round"/>
  <g font-family="sans-serif" font-size="11" fill="#334155">
    <text x="7" y="20">100%</text>
    <text x="13" y="44" fill="#92400e">85%</text>
    <text x="13" y="84">60%</text>
    <text x="44" y="95" text-anchor="middle">1</text>
    <text x="244" y="95" text-anchor="middle">6</text>
    <text x="144" y="95" text-anchor="middle">Frame</text>
  </g>
</svg>
~~~`,
  ].join("\n\n"),
  flowchart = [
    `### ${lastReplyTitle}`,
    `~~~mermaid
flowchart LR
  A[Frame] --> B{"r ≥ 85%?"}
  B -->|Yes| C[Alert]
  B -->|No| D[Log]
  style C fill:#ffedd5,stroke:#b45309,color:#7c2d12
~~~`,
  ].join("\n\n");

export const transcript: TranscriptSnapshot = {
  control: "running",
  eventCursor: 0,
  events: [],
  fileLinks: [],
  messages: [
    message(1, 1, "user", "检查这批导星帧有无曝光饱和。"),
    {
      ...message(2, 1, "assistant", ""),
      toolCalls: [
        { id: callId, index: 0, input: { frames: counts.length }, inputTokens: 6, name: toolName },
      ],
      toolOutputs: {
        [callId]: {
          content: JSON.stringify({ counts, fullScale, limit }),
          images: [],
          outputTokens: 28,
        },
      },
    },
    message(3, 1, "assistant", reply),
    message(forkMessageId, 2, "user", "再画一下告警流程。"),
    {
      ...message(5, 2, "assistant", flowchart),
      usage: { cacheReadTokens: 1200, inputTokens: 2480, outputTokens: 96 },
    },
  ],
  queue: [],
  reasoningTranslations: [],
  transcriptRevision: 1,
};

function message(
  id: number,
  inputId: number,
  role: "user" | "assistant",
  content: string,
): DisplayMessage {
  return {
    content,
    createdAt: observedAt + id,
    id,
    images: [],
    inputId,
    reasoning: "",
    role,
    toolCalls: [],
  };
}

export async function waitForAlertContent(page: Page, withFlowchart: boolean) {
  const diagrams = withFlowchart ? ["SVG", "Mermaid"] : ["SVG"];
  await Promise.all([
    page.locator(".katex-display .katex-html").waitFor(),
    page
      .getByRole("button", { exact: true, name: localize("conversation:toolCall", { toolName }) })
      .waitFor(),
    ...diagrams.map((language) =>
      page
        .getByRole("img", {
          exact: true,
          name: localize("conversation:diagram.label", { language }),
        })
        .evaluate((image: HTMLImageElement) => image.decode()),
    ),
  ]);
}
