import type { Database } from "bun:sqlite";

import { AIMessage } from "@langchain/core/messages";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { contentToText } from "../../../../runtime/content";
import { messageContentToText } from "../../../../runtime/modelContent";
import { inputPredictions } from "../../schema";
import { sessionDatabase } from "../../sqlite/connection";
import { decodeMessage } from "../transcript/messages/hydration";

interface ContextRow {
  message_json: string;
  transcript_revision: number;
  user_json: string;
}
const candidatesSchema = z.array(z.string().trim().min(1)).min(1);
export function readPredictionContext(db: Database, sessionId: string) {
  const row = db
    .query<ContextRow, [string]>(
      `SELECT m.message_json, u.message_json AS user_json, s.transcript_revision
       FROM sessions s JOIN messages m ON m.session_id = s.id
       JOIN messages u ON u.session_id = s.id
         AND u.position = (
           SELECT MAX(position) FROM messages
           WHERE session_id = s.id AND position < m.position
             AND json_extract(message_json, '$.type') = 'human'
         )
       WHERE s.id = ? AND s.control = 'running'
         AND m.position = (SELECT MAX(position) FROM messages WHERE session_id = s.id)
         AND NOT EXISTS (
           SELECT 1 FROM runs WHERE session_id = s.id AND status IN ('pending', 'running', 'paused')
         )`,
    )
    .get(sessionId);
  if (!row) {
    return;
  }
  const message = decodeMessage(row.message_json);
  if (!AIMessage.isInstance(message) || message.tool_calls?.length) {
    return;
  }
  const assistant = messageContentToText(message);
  return assistant.trim()
    ? {
        assistant,
        revision: row.transcript_revision,
        user: contentToText(decodeMessage(row.user_json).content),
      }
    : undefined;
}
export function readPredictionRecord(db: Database, sessionId: string, revision: number) {
  const row = sessionDatabase(db)
    .select({ candidates: inputPredictions.candidates })
    .from(inputPredictions)
    .where(
      and(
        eq(inputPredictions.sessionId, sessionId),
        eq(inputPredictions.transcriptRevision, revision),
      ),
    )
    .get();
  return row ? candidatesSchema.parse(row.candidates) : undefined;
}
export function writePredictionRecord(
  db: Database,
  sessionId: string,
  revision: number,
  candidates: string[],
) {
  return (
    db.run(
      `INSERT INTO input_predictions (session_id, transcript_revision, candidates_json)
     SELECT id, transcript_revision, ? FROM sessions
     WHERE id = ? AND transcript_revision = ?
     ON CONFLICT(session_id) DO UPDATE SET
       transcript_revision = excluded.transcript_revision,
       candidates_json = excluded.candidates_json`,
      [JSON.stringify(candidatesSchema.parse(candidates)), sessionId, revision],
    ).changes === 1
  );
}
