import type { Database } from "bun:sqlite";

import { decodeMessage } from "../infrastructure/database/records/transcript/messages/hydration";
import { queryAll } from "../infrastructure/database/sqlite/connection";
import { contentToText } from "../runtime/content";

interface UserMessageRow {
  created_at: number;
  id: number;
  message_json: string;
  source_id: string;
}
export class UserMessageHistory {
  private snapshot?: ReturnType<typeof loadUserMessages>;
  constructor(private readonly db: Database) {}
  read() {
    this.snapshot ??= loadUserMessages(this.db);
    return this.snapshot;
  }
  invalidate() {
    this.snapshot = undefined;
  }
}
function loadUserMessages(db: Database) {
  return queryAll<UserMessageRow>(
    db,
    `SELECT id, source_id, message_json, created_at
     FROM messages
     WHERE position IS NOT NULL AND json_extract(message_json, '$.type') = 'human'
     ORDER BY created_at, id`,
  ).map((row) => {
    const message = decodeMessage(row.message_json, row.source_id);
    return { content: contentToText(message.content), createdAt: row.created_at };
  });
}
