import { claimShortId } from "../../../../../infrastructure/randomId";
import {
  attachmentIds,
  attachmentPlaceholder,
  type AttachmentSettings,
  type PendingAttachment,
  validateAttachmentBatch,
} from "../../../../attachments/contract";
import { browserI18n } from "../../../i18n";
import { reportError } from "../../../services/errors";

const t = browserI18n.getFixedT(null, "attachments");

export class PendingAttachments {
  private readonly entries = new Map<string, PendingAttachment>();
  constructor(private settings?: AttachmentSettings) {}
  configure(settings?: AttachmentSettings) {
    this.settings = settings;
  }
  paste(files: File[], contents: readonly string[]) {
    try {
      return this.add(files, contents);
    } catch (error) {
      reportError(error);
      return undefined;
    }
  }
  private add(files: File[], contents: readonly string[]) {
    if (!this.settings) {
      return undefined;
    }
    const retained = this.values(contents).map(({ file }) => file);
    validateAttachmentBatch([...retained, ...files], this.settings, t);
    return files
      .map((file) => {
        const id = claimShortId((candidate) => {
          if (this.entries.has(candidate)) {
            return false;
          }
          this.entries.set(candidate, { file, id: candidate });
          return true;
        });
        return attachmentPlaceholder(id, file.name);
      })
      .join("\n");
  }
  values(contents: readonly string[]) {
    const referenced = attachmentIds(contents);
    return [...this.entries.values()].filter(({ id }) => referenced.has(id));
  }
  restore(attachments: PendingAttachment[]) {
    this.entries.clear();
    for (const attachment of attachments) {
      this.entries.set(attachment.id, attachment);
    }
  }
  clear() {
    this.entries.clear();
  }
}
