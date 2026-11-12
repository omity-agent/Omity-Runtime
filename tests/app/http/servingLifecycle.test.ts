import { expect, test } from "bun:test";
import { join } from "node:path";

import { httpServerOptions } from "../../../settings/networking";
import { createStaticApp } from "../../../src/app/http/static";
import { createTestDirectory } from "../../support/artifacts";
import { liveApplication } from "./liveApplication";

test("static asset responses expose their complete body length", async () => {
  const root = createTestDirectory("static-assets"),
    assetPath = join(root, "assets", "config.json"),
    content = '{"ready":true}';
  await Bun.write(assetPath, content);
  const server = Bun.serve({
    ...httpServerOptions,
    fetch: createStaticApp(root).fetch,
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const response = await fetch(new URL("/assets/config.json", server.url)),
      body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe(
      new TextEncoder().encode(content).byteLength.toString(),
    );
    expect(body).toBe(content);
  } finally {
    await server.stop(true);
  }
});
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
