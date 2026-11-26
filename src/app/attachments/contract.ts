import type { TFunction } from "i18next";

import { DomainError } from "../../failures/domain";
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
export function replaceAttachmentPlaceholders(
  content: string,
  replacement: (id: string) => string,
) {
  return content.replaceAll(placeholderPattern, (_match: string, id: string) =>
    replacement(id.toLowerCase()),
  );
}
export function fileSuffix(name: string) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index).toLowerCase() : "";
}
function validateAttachment(
  file: unknown,
  settings: AttachmentSettings,
  t: TFunction<"attachments">,
): asserts file is AttachmentMetadata {
  if (
    typeof file !== "object" ||
    file === null ||
    !("name" in file) ||
    typeof file.name !== "string" ||
    file.name.length === 0
  ) {
    throw new DomainError("ATTACHMENT_INVALID", t("fileNameMissing"));
  }
  if (
    !("size" in file) ||
    typeof file.size !== "number" ||
    !Number.isSafeInteger(file.size) ||
    file.size < 0
  ) {
    throw new DomainError("ATTACHMENT_INVALID", t("sizeInvalid", { fileName: file.name }));
  }
  const suffix = fileSuffix(file.name);
  if (!settings.allowedSuffixes.includes(suffix)) {
    throw new DomainError(
      "ATTACHMENT_INVALID",
      t("suffixUnsupported", {
        suffix: suffix || t("noSuffix"),
      }),
    );
  }
  if (file.size > settings.maxSizeBytes) {
    throw new DomainError(
      "ATTACHMENT_TOO_LARGE",
      t("fileTooLarge", {
        fileName: file.name,
        maxBytes: settings.maxSizeBytes,
      }),
    );
  }
}
export function validateAttachmentBatch(
  files: readonly unknown[],
  settings: AttachmentSettings,
  t: TFunction<"attachments">,
) {
  let total = 0;
  for (const file of files) {
    validateAttachment(file, settings, t);
    total += file.size;
  }
  if (!Number.isSafeInteger(total)) {
    throw new DomainError("ATTACHMENT_TOO_LARGE", t("totalSizeUnsafe"));
  }
  if (total > settings.maxSizeBytes) {
    throw new DomainError(
      "ATTACHMENT_TOO_LARGE",
      t("totalSizeTooLarge", {
        maxBytes: settings.maxSizeBytes,
      }),
    );
  }
}
