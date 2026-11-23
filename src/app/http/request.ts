import { zValidator } from "@hono/zod-validator";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";

import { localize } from "../../i18n/server";
import { safeId } from "../../infrastructure/configuration/sessionPaths";
import { HttpError } from "./errors";

const jsonContentType = /^application\/(?:[a-z.-]+\+)?json(?:;\s*[a-z0-9-]+=[^;]+)*$/iu;
export function limitRequestBody(maxSize: number, label = localize("http:request.bodyLabel")) {
  return bodyLimit({
    maxSize,
    onError() {
      throw new HttpError(
        413,
        localize("http:request.bodyTooLarge", {
          value0: label,
          value1: maxSize.toString(),
        }),
      );
    },
  });
}
export function validate<Target extends "json" | "form" | "query", Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result, c) => {
    if (target === "json" && !jsonContentType.test(c.req.header("content-type") ?? "")) {
      throw new HttpError(400, localize("http:request.invalidBody"));
    }
    if (!result.success) {
      throw new HttpError(
        400,
        localize("http:request.invalidParameters", { value0: z.prettifyError(result.error) }),
      );
    }
  });
}
export function requestValidation(maxSize: number) {
  const limit = limitRequestBody(maxSize);
  return {
    json<Schema extends z.ZodType>(this: void, schema: Schema) {
      return [limit, validate("json", schema)] as const;
    },
    limit,
  };
}
export function decodeSessionId(value: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new HttpError(400, localize("http:request.sessionIdInvalid"));
  }
  try {
    return safeId(decoded);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : String(error));
  }
}
