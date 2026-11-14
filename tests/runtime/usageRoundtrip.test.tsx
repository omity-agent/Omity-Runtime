import { afterEach, beforeAll, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ContextUsage } from "../../src/app/frontend/components/Chat/ContextUsage";
import { i18nReady } from "../../src/app/frontend/i18n";
import { loadTranscript } from "../../src/app/transcript";
import { cleanupDatabaseDirs, makeDb, required, workspace } from "../support/database";
import { wireModel } from "./discovery/wireFixtures";

afterEach(cleanupDatabaseDirs);
beforeAll(async () => {
  await i18nReady;
});
test.each([
  [2000, undefined, 10],
  [2000, null, 10],
  [2000, 0, 10],
  [2000, 1536, 10],
  [undefined, undefined, undefined],
  [undefined, 0, 10],
  [0, 0, 10],
] as const)(
  "usage roundtrip preserves input %s cache %s output %s",
  async (input, cacheRead, output) => {
    const usage =
      output === undefined
        ? undefined
        : {
            completion_tokens: output,
            prompt_tokens: input,
            prompt_tokens_details: { cached_tokens: cacheRead },
          };
    await using wire = wireModel("completions", [
      {
        choices: [
          { delta: { content: "Done", role: "assistant" }, finish_reason: "stop", index: 0 },
        ],
        created: 1,
        id: "usage-response",
        model: "test",
        usage,
      },
    ]);
    using db = makeDb();
    db.createSession("usage", workspace);
    await db.syncHistory("usage", [await wire.requestModel()]);
    const projected = required(loadTranscript(db.db, "usage").messages.at(-1)?.usage);
    expect(projected).toMatchObject({
      cacheReadTokens: cacheRead ?? undefined,
      inputTokens: input,
      outputTokens: output,
    });
    projected.estimatedCacheHitRate = 0.9;
    const unknown = input === undefined || input === 0 || cacheRead == null,
      display = unknown ? "—" : `${((cacheRead / input) * 100).toFixed(2)}%`,
      markup = renderToStaticMarkup(<ContextUsage usage={projected} cacheHitWarningRatio={0.9} />);
    expect(markup).toContain(`KV Cache: ${display}`);
    if (unknown) {
      expect(markup).toBe(renderToStaticMarkup(<ContextUsage usage={projected} />));
    }
  },
);
