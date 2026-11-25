import type { Database } from "bun:sqlite";

import { AIMessage, HumanMessage } from "@langchain/core/messages";

import { localize } from "../../i18n/server";
import { decodeMessage } from "../../infrastructure/database/records/transcript/messages/hydration";
import { queryAll } from "../../infrastructure/database/sqlite/connection";
import { contentToText } from "../../runtime/content";
import { messageContentToText } from "../../runtime/modelContent";
import { countTokens } from "../../runtime/tokenizer";

interface MessageRow {
  created_at: number;
  message_json: string;
  session_id: string;
  source_id: string;
  token_count: number | null;
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
      `SELECT session_id, source_id, message_json, created_at, token_count
     FROM messages
     WHERE position IS NOT NULL
     ORDER BY session_id, position`,
    ),
    sessionUpdates = queryAll<{ updated_at: number }>(
      db,
      `SELECT MAX(
          s.updated_at,
          COALESCE(
            (SELECT MAX(m.created_at) FROM messages m
             WHERE m.session_id = s.id AND m.position IS NOT NULL),
            s.updated_at
          )
        ) AS updated_at
       FROM sessions s`,
    ).map(({ updated_at }) => updated_at),
    samples: PredictionSample[] = [];
  for (const sessionMessages of Map.groupBy(messages, (row) => row.session_id).values()) {
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
        samples.push({
          assistant: latestAssistant.content,
          contextTokens: contextTokens - tokenCount,
          createdAt: row.created_at,
          id: `${row.session_id}:${latestAssistant.id}:${row.source_id}`,
          user: content,
          userTokens: tokenCount,
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
    throw new TypeError(localize("application:prediction.contextTokenCountUnsafe"));
  }
  return result;
}
