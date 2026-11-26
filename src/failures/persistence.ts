import { localize } from "../i18n/server";
import { type ErrorDetails, errorDetailsSchema } from "./details";

export function parseError(value: string): ErrorDetails {
  const parsed: unknown = JSON.parse(value),
    result = errorDetailsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(localize("errors:failure.invalidQueueDetails"));
  }
  return result.data;
}
export function stringifyError(error: ErrorDetails) {
  return JSON.stringify(error);
}
