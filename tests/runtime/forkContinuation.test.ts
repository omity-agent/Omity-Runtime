import { afterEach, expect, test } from "bun:test";

import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { forkConversation } from "../../src/app/runtime/sessions/branch";
import {
  readComposerDraftRecord,
  writeComposerDraftRecord,
} from "../../src/infrastructure/database/records/session/composerDrafts";
import { runTransaction } from "../../src/infrastructure/database/sqlite/connection";
import { processInput } from "../../src/runtime/consumeInputs";
import { cleanupDatabaseDirs, makeDb, required, workspace } from "../support/database";
import { agentFixture } from "./support/agentFixture";

afterEach(cleanupDatabaseDirs);
test.each(["", "unsent draft"])(
  "fork continues without submitting the composer: %j",
  async (draft) => {
    using target = makeDb();
    await prepareFork(target, new AIMessage("previous answer"));
    writeComposerDraftRecord(target.db, "target", draft, 2);
    using fixture = agentFixture({ db: target });
    const before = target.history("target").filter((message) => HumanMessage.isInstance(message));
    expect(target.nextInput("target")?.status).toBe("paused");
    target.setControl("target", "running");
    await processInput(fixture.context, required(target.nextInput("target")));
    expect(fixture.model.doStreamCalls).toHaveLength(1);
    expect(target.nextInput("target")).toBeNull();
    expect(target.history("target").filter((message) => HumanMessage.isInstance(message))).toEqual(
      before,
    );
    expect(readComposerDraftRecord(target.db, "target").content).toBe(draft);
    expect(target.history("target").at(-1)?.text).toBe("continued");
  },
);
test("fork resumes pending tools before requesting the model", async () => {
  using target = makeDb();
  let called = 0;
  const echo = tool(
    () => {
      called += 1;
      return "echoed";
    },
    {
      description: "echo",
      name: "echo",
      schema: z.object({}),
    },
  );
  await prepareFork(
    target,
    new AIMessage({
      content: "",
      tool_calls: [{ args: {}, id: "echo-call", name: "echo" }],
    }),
  );
  using fixture = agentFixture({ db: target, tools: [echo] });
  target.setControl("target", "running");
  await processInput(fixture.context, required(target.nextInput("target")));
  expect(called).toBe(1);
  expect(target.nextInput("target")).toBeNull();
  expect(fixture.model.doStreamCalls).toHaveLength(1);
  expect(
    target.history("target").filter((message) => ToolMessage.isInstance(message)),
  ).toHaveLength(1);
});
async function prepareFork(db: ReturnType<typeof makeDb>, response: AIMessage) {
  db.resetSession("source", workspace);
  db.appendUser("source", "first user");
  db.consumeInput("source", required(db.nextInput("source")));
  await db.syncHistory("source", [...db.history("source"), response]);
  db.appendUser("source", "deleted fork message");
  const messageId = db.consumeInput("source", required(db.pendingInputs("source")[0]));
  runTransaction(db.db, () =>
    forkConversation(db.db, {
      beforeMessageId: messageId,
      profiles: [],
      sourceSessionId: "source",
      targetSessionId: "target",
      workspace,
    }),
  );
}
