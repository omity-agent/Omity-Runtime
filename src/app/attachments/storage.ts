import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { DomainError } from "../../errors";
import { hasErrorCode } from "../../failures/thrownValues";
import { localize } from "../../i18n/server";
import { resolveSessionPaths } from "../../infrastructure/configuration/sessionPaths";
import { claimShortIdAsync } from "../../infrastructure/randomId";
import type { Settings } from "../../types";
import {
  attachmentIds,
  fileSuffix,
  materializeAttachmentPaths,
  missingAttachment,
  type PendingAttachment,
  validateAttachmentBatch,
} from "./contract";

export async function saveAttachments(
  settings: Settings,
  sessionId: string,
  contents: readonly string[],
  attachments: PendingAttachment[],
) {
  const referenced = attachmentIds(contents),
    selected = attachments.filter(({ id }) => referenced.has(id)),
    paths = new Map<string, string>(),
    discard = () => Promise.all([...paths.values()].map((path) => rm(path, { force: true })));
  validateSelected(selected, referenced, settings);
  try {
    const directory = join(resolveSessionPaths(sessionId).dir, "attachments");
    if (selected.length > 0) {
      await mkdir(directory, { recursive: true });
    }
    for (const { id, file } of selected) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let path = "";
      await claimShortIdAsync(async (fileId) => {
        path = join(directory, `${fileId}${fileSuffix(file.name)}`);
        try {
          await writeFile(path, bytes, { flag: "wx" });
          return true;
        } catch (error) {
          if (hasErrorCode(error, "EEXIST")) {
            return false;
          }
          throw error;
        }
      });
      paths.set(id, path);
    }
    return {
      discard,
      rewrite: (content: string) => materializeAttachmentPaths(content, paths),
    };
  } catch (error) {
    await discard();
    throw error;
  }
}
function validateSelected(
  selected: PendingAttachment[],
  referenced: Set<string>,
  settings: Settings,
) {
  const ids = new Set<string>();
  for (const attachment of selected) {
    if (ids.has(attachment.id)) {
      throw new DomainError(
        "ATTACHMENT_INVALID",
        localize("application:attachments.duplicateId", { value0: attachment.id }),
      );
    }
    ids.add(attachment.id);
  }
  validateAttachmentBatch(
    selected.map(({ file }) => file),
    settings.attachments,
  );
  for (const id of referenced) {
    if (!ids.has(id)) {
      throw missingAttachment(id);
    }
  }
}
