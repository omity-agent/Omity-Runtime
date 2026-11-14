import { expect, test } from "bun:test";

import { DraftSaver } from "../../../../src/app/frontend/services/scheduling/draftSaver";

test("draft flush exposes HTTP failures and subsequent saves remain serialized", async () => {
  const requests: string[] = [],
    errors: unknown[] = [];
  let failing = true;
  const server = Bun.serve({
    async fetch(request) {
      requests.push(await request.text());
      return new Response("draft unavailable", { status: failing ? 503 : 200 });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  const saver = new DraftSaver(
    { kind: "session", sessionId: "editing" },
    1000,
    (error) => errors.push(error),
    async (_target, content) => {
      const response = await fetch(server.url, { body: content, method: "PUT" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
  );
  try {
    saver.schedule("first draft", 1);
    await expect(saver.flush()).rejects.toThrow("draft unavailable");
    failing = false;
    saver.schedule("second draft", 2);
    const first = saver.flush();
    saver.schedule("latest draft", 3);
    await Promise.all([first, saver.flush()]);
    expect(requests).toEqual(["first draft", "second draft", "latest draft"]);
    expect(errors).toHaveLength(1);
  } finally {
    saver.discardPending();
    await server.stop(true);
  }
});
