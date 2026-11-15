import { afterEach, expect, test } from "bun:test";

import { HumanMessage } from "@langchain/core/messages";

import { historyInput } from "../../../src/agent/graph/historyInput";
import { processInput } from "../../../src/runtime/consumeInputs";
import { cleanupDatabaseDirs, required, workspace } from "../../support/database";
import { agentFixture } from "../support/agentFixture";

afterEach(cleanupDatabaseDirs);
test("host reconstruction merges an uncheckpointed consumed message with newly queued input", async () => {
  using first = agentFixture();
  const { context, db } = first;
  db.resetSession("target", workspace);
  db.appendUser("target", "checkpointed");
  const initial = required(db.nextInput("target"));
  db.consumeInput("target", initial);
  await context.graph.invoke(historyInput(db.history("target")), {
    configurable: { thread_id: initial.runId.toString() },
    interruptBefore: ["model_request"],
  });
  db.appendUser("target", "consumed before shutdown");
  db.consumeInput("target", required(db.pendingInputs("target")[0]));
  db.appendUser("target", "queued before restart");
  db.pauseRun("target", initial.runId);
  first.executions.close();
  using resumed = agentFixture({ db });
  db.setControl("target", "running");
  await processInput(resumed.context, required(db.nextInput("target")));
  const texts = ["checkpointed", "consumed before shutdown", "queued before restart"];
  expect(resumed.model.doStreamCalls).toHaveLength(1);
  expect(
    resumed.model.doStreamCalls[0]?.prompt.filter(({ role }) => role === "user"),
  ).toMatchObject(texts.map((text) => ({ content: [{ text, type: "text" }], role: "user" })));
  expect(
    db
      .history("target")
      .filter((message) => HumanMessage.isInstance(message))
      .map(({ text }) => text),
  ).toEqual(texts);
  expect(db.nextInput("target")).toBeNull();
});
