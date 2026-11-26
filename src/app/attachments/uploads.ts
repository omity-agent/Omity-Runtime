import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";

import { DomainError } from "../../failures/domain";
import { hasErrorCode } from "../../failures/thrownValues";
import { serverI18n } from "../../i18n/server";
import { resolveSessionPaths } from "../../infrastructure/configuration/sessionPaths";
import { claimShortIdAsync } from "../../infrastructure/randomId";
import {
  attachmentIds,
  type AttachmentSettings,
  fileSuffix,
  type PendingAttachment,
  replaceAttachmentPlaceholders,
  validateAttachmentBatch,
} from "./contract";

const t = serverI18n.getFixedT(null, "attachments");

export async function withSavedAttachments<Result>(
  settings: AttachmentSettings,
  sessionId: string,
  contents: readonly string[],
  attachments: PendingAttachment[],
  consume: (rewrite: (content: string) => string) => Result | Promise<Result>,
) {
  await using rollback = new AsyncDisposableStack();
  const referenced = attachmentIds(contents),
    selected = attachments.filter(({ id }) => referenced.has(id)),
    paths = new Map<string, string>();
  validateSelected(selected, referenced, settings);
  const directory = join(resolveSessionPaths(sessionId).dir, "attachments");
  if (selected.length > 0) {
    await mkdir(directory, { recursive: true });
  }
  for (const { id, file } of selected) {
    const bytes = new Uint8Array(await file.arrayBuffer()),
      suffix = fileSuffix(file.name),
      pathFor = (fileId: string) => join(directory, `${fileId}${suffix}`),
      fileId = await claimShortIdAsync(async (candidate) => {
        const path = pathFor(candidate);
        try {
          await using target = await open(path, "wx");
          rollback.defer(() => rm(path, { force: true }));
          await target.writeFile(bytes);
        } catch (error) {
          if (hasErrorCode(error, "EEXIST")) {
            return false;
          }
          throw error;
        }
        return true;
      });
    paths.set(id, pathFor(fileId));
  }
  const result = await consume((content) =>
    replaceAttachmentPlaceholders(content, (id) => {
      const path = paths.get(id);
      if (path === undefined) {
        throw missingAttachment(id);
      }
      return path.replaceAll("\\", "/");
    }),
  );
  rollback.move();
  return result;
}
function validateSelected(
  selected: PendingAttachment[],
  referenced: Set<string>,
  settings: AttachmentSettings,
) {
  const ids = new Set<string>();
  for (const attachment of selected) {
    if (ids.has(attachment.id)) {
      throw new DomainError(
        "ATTACHMENT_INVALID",
        t("duplicateId", { attachmentId: attachment.id }),
      );
    }
    ids.add(attachment.id);
  }
  validateAttachmentBatch(
    selected.map(({ file }) => file),
    settings,
    t,
  );
  for (const id of referenced) {
    if (!ids.has(id)) {
      throw missingAttachment(id);
    }
  }
}
function missingAttachment(attachmentId: string) {
  return new DomainError("ATTACHMENT_INVALID", t("referencedFileMissing", { attachmentId }));
}
