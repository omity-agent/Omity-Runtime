import { expect, test } from "bun:test";

import { PredictionService } from "../../../src/app/prediction/service";
import { createPredictionFixture } from "./modelFixture";

test("generated predictions survive a new service and a separate process", async () => {
  await using value = await createPredictionFixture();
  const { service, sessionId, settings, replies, requests } = value;
  void service.onIdle(sessionId);
  void service.onIdle(sessionId);
  expect(await service.get(sessionId)).toEqual(replies);
  expect(requests).toHaveLength(1);
  expect(JSON.stringify(requests[0])).toContain("当前回复 &lt;current&gt;");
  expect(JSON.stringify(requests[0])).toContain("历史回复 &lt;sample&gt;");
  expect(await new PredictionService(settings).get(sessionId)).toEqual(replies);
  const child = Bun.spawn(
      [
        process.execPath,
        "--eval",
        `import { PredictionService } from "./src/app/prediction/service.ts";
         console.log(JSON.stringify(await new PredictionService(${JSON.stringify(settings)}).get(${JSON.stringify(sessionId)})));`,
      ],
      { cwd: process.cwd(), env: { ...process.env }, stderr: "pipe", stdout: "pipe" },
    ),
    output = await new Response(child.stdout).text(),
    errors = await new Response(child.stderr).text();
  expect(await child.exited).toBe(0);
  expect(errors).toBe("");
  expect(JSON.parse(output)).toEqual(replies);
  expect(requests).toHaveLength(1);
});
test("reading a completed session generates a missing prediction without an idle event", async () => {
  await using value = await createPredictionFixture();
  const { service, sessionId, replies, requests } = value;
  expect(await service.get(sessionId)).toEqual(replies);
  expect(requests).toHaveLength(1);
});
test("new input hides persisted predictions and deleting a session removes its record", async () => {
  await using value = await createPredictionFixture();
  const { database, service, sessionId, replies } = value;
  void service.onIdle(sessionId);
  expect(await service.get(sessionId)).toEqual(replies);
  database.appendUser(sessionId, "另一个任务");
  expect(await service.get(sessionId)).toEqual([]);
  database.deleteSession(sessionId);
  expect(
    database.db
      .query<{ total: number }, [string]>(
        "SELECT COUNT(*) AS total FROM input_predictions WHERE session_id = ?",
      )
      .get(sessionId)?.total,
  ).toBe(0);
});
test("disabled prediction does not return saved suggestions or call the model", async () => {
  await using value = await createPredictionFixture();
  const { service, sessionId, settings, replies, requests } = value;
  void service.onIdle(sessionId);
  expect(await service.get(sessionId)).toEqual(replies);
  expect(
    await new PredictionService({
      ...settings,
      prediction: { ...settings.prediction!, enabled: false },
    }).get(sessionId),
  ).toEqual([]);
  expect(requests).toHaveLength(1);
});
test("insufficient samples do not issue a model request", async () => {
  await using value = await createPredictionFixture();
  const { sessionId, settings, requests } = value,
    service = new PredictionService({
      ...settings,
      prediction: { ...settings.prediction!, sampleCount: 100_000 },
    });
  void service.onIdle(sessionId);
  expect(await service.get(sessionId)).toEqual([]);
  expect(requests).toHaveLength(0);
});
