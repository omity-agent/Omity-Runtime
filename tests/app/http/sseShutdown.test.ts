import { expect, test } from "bun:test";

import { liveApplication } from "./liveApplication";

test("HTTP shutdown closes pending reads from an active event stream", async () => {
  let disconnected: Promise<PromiseSettledResult<{ done?: boolean }>[]>;
  {
    await using app = liveApplication();
    const response = await fetch(`${app.url}/api/events/state`),
      reader = response.body!.getReader(),
      initial = await reader.read();
    expect(response.status).toBe(200);
    expect(new TextDecoder().decode(initial.value)).toContain("event: restore");
    disconnected = Promise.allSettled([reader.read()]);
  }
  const [outcome] = await disconnected;
  expect(
    outcome?.status === "rejected" || (outcome?.status === "fulfilled" && outcome.value.done),
  ).toBe(true);
});
