import { DomainError } from "../../errors";
import { localize } from "../../i18n/server";
import type { Settings } from "../../types";
import type { InitialMessagePair } from "../initialState";

export type { MessageSubmission, SessionSubmission } from "./submission";
export interface PendingAttachment {
  id: string;
  file: File;
}
export type AttachmentSettings = Settings["attachments"];
interface AttachmentMetadata {
  name: string;
  size: number;
}
const placeholderPattern = /\{\{file:(?<id>[0-9a-z]{8}):(?<name>[^{}\r\n]+)\}\}/giu;
export function attachmentPlaceholder(id: string, name: string) {
  return `{{file:${id}:${name.replaceAll(/[{}\r\n]/gu, "_")}}}`;
}
export function initialAttachmentTexts(history: readonly InitialMessagePair[], message: string) {
  return [...history.flatMap(({ assistant, user }) => [user, assistant]), message];
}
export function attachmentIds(contents: readonly string[]) {
  return new Set(
    contents.flatMap((content) =>
      Array.from(content.matchAll(placeholderPattern), (match) => match[1]!.toLowerCase()),
    ),
  );
}
export function missingAttachment(id: string) {
  return new DomainError(
    "ATTACHMENT_INVALID",
    localize("application:attachments.referencedFileMissing", { value0: id }),
  );
}
export function materializeAttachmentPaths(content: string, paths: ReadonlyMap<string, string>) {
  return content.replaceAll(placeholderPattern, (_match: string, id: string) => {
    const path = paths.get(id.toLowerCase());
    if (path === undefined) {
      throw missingAttachment(id);
    }
    return path.replaceAll("\\", "/");
  });
}
export function fileSuffix(name: string) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index).toLowerCase() : "";
}
function validateAttachment(
  file: unknown,
  settings: AttachmentSettings,
): asserts file is AttachmentMetadata {
  if (
    typeof file !== "object" ||
    file === null ||
    !("name" in file) ||
    typeof file.name !== "string" ||
    file.name.length === 0
  ) {
    throw new DomainError(
      "ATTACHMENT_INVALID",
      localize("application:attachments.fileNameMissing"),
    );
  }
  if (
    !("size" in file) ||
    typeof file.size !== "number" ||
    !Number.isSafeInteger(file.size) ||
    file.size < 0
  ) {
    throw new DomainError(
      "ATTACHMENT_INVALID",
      localize("application:attachments.sizeInvalid", { value0: file.name }),
    );
  }
  const suffix = fileSuffix(file.name);
  if (!settings.allowedSuffixes.includes(suffix)) {
    throw new DomainError(
      "ATTACHMENT_INVALID",
      localize("application:attachments.suffixUnsupported", {
        value0: suffix || localize("errors:generic.noSuffix"),
      }),
    );
  }
  if (file.size > settings.maxSizeBytes) {
    throw new DomainError(
      "ATTACHMENT_TOO_LARGE",
      localize("application:attachments.fileTooLarge", {
        value0: file.name,
        value1: settings.maxSizeBytes.toString(),
      }),
    );
  }
}
export function validateAttachmentBatch(files: readonly unknown[], settings: AttachmentSettings) {
  let total = 0;
  for (const file of files) {
    validateAttachment(file, settings);
    total += file.size;
  }
  if (!Number.isSafeInteger(total)) {
    throw new DomainError(
      "ATTACHMENT_TOO_LARGE",
      localize("application:attachments.totalSizeUnsafe"),
    );
  }
  if (total > settings.maxSizeBytes) {
    throw new DomainError(
      "ATTACHMENT_TOO_LARGE",
      localize("application:attachments.totalSizeTooLarge", {
        value0: settings.maxSizeBytes.toString(),
      }),
    );
  }
}
