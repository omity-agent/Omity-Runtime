import { del, get, set } from "idb-keyval";

import type { PendingAttachment } from "../../../attachments/contract";
import {
  emptyPreparation,
  parsePreparation,
  type SessionPreparation,
} from "../../../composition/preparation";
import { loadPreparationDraft } from "../client";
import { z } from "../validation";

const key = "omity:session-preparation",
  snapshotSchema = z.object({ content: z.string(), revision: z.number().int().nonnegative() });
export async function restorePreparation() {
  const [remote, attachments] = await Promise.all([
      loadPreparationDraft(),
      get<PendingAttachment[]>(key),
    ]),
    cached = sessionStorage.getItem(key),
    local = cached === null ? undefined : snapshotSchema.parse(JSON.parse(cached)),
    snapshot = local && local.revision > remote.revision ? local : remote;
  return {
    attachments: attachments ?? [],
    draft: snapshot.content === null ? emptyPreparation() : parsePreparation(snapshot.content),
    revision: snapshot.revision,
  };
}
export function retainPreparation(draft: SessionPreparation, revision: number) {
  sessionStorage.setItem(key, JSON.stringify({ content: JSON.stringify(draft), revision }));
}
export function retainFiles(attachments: PendingAttachment[]) {
  return attachments.length === 0 ? del(key) : set(key, attachments);
}
