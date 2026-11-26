import type { Database } from "bun:sqlite";

import { localize } from "../../../../i18n/server";
import { cachedQuery } from "../../sqlite/connection";

interface ToolStreamIdentity {
  messageId: string;
  partId: string;
}
export function findToolStreamIdentity(
  db: Database,
  sessionId: string,
  callId: string,
): ToolStreamIdentity | null {
  const identities = cachedQuery<ToolStreamIdentity>(
    db,
    `SELECT DISTINCT message_id AS messageId, part_id AS partId FROM events
     WHERE session_id = ? AND kind = 'tool_call_delta'
       AND json_type(payload_json, '$.idDelta') = 'text'
       AND json_extract(payload_json, '$.idDelta') = ?
     LIMIT 2`,
  ).all(sessionId, callId);
  if (identities.length > 1) {
    throw new Error(localize("database:transcript.formalCallStreamIdentityDuplicate", { callId }));
  }
  return identities[0] ?? null;
}
