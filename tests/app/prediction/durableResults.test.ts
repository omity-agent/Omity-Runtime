import { expect, test } from "bun:test";

import { PredictionService } from "../../../src/app/prediction/service";
import { createPredictionFixture } from "./modelFixture";

test.each([1, 4])(
  "exactly %i predictions survive a new service and a separate process",
  async (count) => {
    await using value = await createPredictionFixture(count);
    const { service, sessionId, settings, replies, requests } = value,
      pending = service.get(sessionId);
    void service.onIdle(sessionId);
    void service.onIdle(sessionId);
    expect(await pending).toEqual(replies);
    expect(requests).toHaveLength(1);
    expect(await new PredictionService(() => settings.prediction).get(sessionId)).toEqual(replies);
    const child = Bun.spawn(
        [
          process.execPath,
          "--eval",
          `import { PredictionService } from "./src/app/prediction/service.ts";
         console.log(JSON.stringify(await new PredictionService(() => (${JSON.stringify(settings.prediction)})).get(${JSON.stringify(sessionId)})));`,
        ],
        { cwd: process.cwd(), env: { ...process.env }, stderr: "pipe", stdout: "pipe" },
      ),
      output = await new Response(child.stdout).text(),
      errors = await new Response(child.stderr).text();
    expect(await child.exited).toBe(0);
    expect(errors).toBe("");
    expect(JSON.parse(output)).toEqual(replies);
    expect(requests).toHaveLength(1);
  },
);
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
    await new PredictionService(() => ({
      ...settings.prediction!,
      enabled: false,
    })).get(sessionId),
  ).toEqual([]);
  expect(requests).toHaveLength(1);
});
test("insufficient samples do not issue a model request", async () => {
  await using value = await createPredictionFixture();
  const { sessionId, settings, requests } = value,
    service = new PredictionService(() => ({ ...settings.prediction!, sampleCount: 100_000 }));
  void service.onIdle(sessionId);
  expect(await service.get(sessionId)).toEqual([]);
  expect(requests).toHaveLength(0);
});
