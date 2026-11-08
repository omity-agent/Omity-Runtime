import type { Database } from "bun:sqlite";

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { groupBy } from "es-toolkit";

import { localize } from "../../i18n/server";
import { decodeMessage } from "../../infrastructure/database/records/transcript/messages/hydration";
import { queryAll } from "../../infrastructure/database/sqlite/connection";
import { contentToText } from "../../runtime/content";
import { messageContentToText } from "../../runtime/modelContent";
import { countTokens } from "../../runtime/tokenizer";

interface MessageRow {
  created_at: number;
  id: number;
  message_json: string;
  position: number;
  session_id: string;
  source_id: string;
  token_count: number | null;
}
interface SessionRow {
  id: string;
  updated_at: number;
}
export interface PredictionSample {
  assistant: string;
  contextTokens: number;
  createdAt: number;
  id: string;
  user: string;
  userTokens: number;
}
export function loadPredictionSnapshot(db: Database) {
  const messages = queryAll<MessageRow>(
      db,
      `SELECT id, session_id, source_id, message_json, position, created_at, token_count
     FROM messages
     WHERE position IS NOT NULL
     ORDER BY session_id, position`,
    ),
    sessionUpdates = new Map(
      queryAll<SessionRow>(
        db,
        `SELECT s.id,
        MAX(
          s.updated_at,
          COALESCE(
            (SELECT MAX(m.created_at) FROM messages m
             WHERE m.session_id = s.id AND m.position IS NOT NULL),
            s.updated_at
          )
        ) AS updated_at
       FROM sessions s`,
      ).map(({ id, updated_at }) => [id, updated_at]),
    ),
    samples: PredictionSample[] = [];
  for (const sessionMessages of Object.values(groupBy(messages, (row) => row.session_id))) {
    let contextTokens = 0,
      latestAssistant: { content: string; id: string } | undefined;
    for (const row of sessionMessages) {
      const message = decodeMessage(row.message_json, row.source_id),
        content =
          message.type === "ai" ? messageContentToText(message) : contentToText(message.content),
        tokenCount = row.token_count ?? countTokens(content);
      contextTokens = addTokens(contextTokens, tokenCount);
      if (AIMessage.isInstance(message)) {
        latestAssistant =
          content.trim() && !message.tool_calls?.length
            ? { content, id: row.source_id }
            : undefined;
      } else if (HumanMessage.isInstance(message) && latestAssistant) {
        const userTokens = row.token_count ?? countTokens(content);
        samples.push({
          assistant: latestAssistant.content,
          contextTokens: contextTokens - tokenCount,
          createdAt: row.created_at,
          id: `${row.session_id}:${latestAssistant.id}:${row.source_id}`,
          user: content,
          userTokens,
        });
        latestAssistant = undefined;
      }
    }
  }
  return { samples, sessionUpdates };
}
function addTokens(left: number, right: number) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(localize("application:prediction.contextTokenCountUnsafe"));
  }
  return result;
}
