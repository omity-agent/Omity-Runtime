import type { ToolCall } from "@langchain/core/messages";
import { isPlainObject as isRecord } from "es-toolkit";

import { localize } from "../i18n/server";

export function rawFreeformInput(input: unknown) {
  if (isRecord(input) && typeof input["input"] === "string") {
    return input["input"];
  }
  if (typeof input === "string") {
    return input;
  }
  throw new Error(localize("runtime:tool.freeformInputMissing"));
}
export function freeformCallInput(call: ToolCall) {
  return Reflect.get(call, "isCustomTool") === true ? rawFreeformInput(call.args) : undefined;
}
