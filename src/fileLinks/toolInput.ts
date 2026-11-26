import { parseDocument, stringify } from "yaml";

interface ToolInputSource {
  input: unknown;
  rawInput?: string;
}
const recoverableEndErrors = new Set(["BAD_INDENT", "MISSING_CHAR"]);
export function formatToolInput(call: ToolInputSource) {
  if (call.rawInput !== undefined) {
    return trimFreeformInput(call.rawInput);
  }
  return call.input === undefined
    ? ""
    : stringify(call.input, { lineWidth: 0 }).replace(/\n$/u, "");
}
export function trimFreeformInput(input: string) {
  const contentEnd = input.trimEnd().length;
  if (contentEnd === 0) {
    return "";
  }
  const lineBreak = input.slice(contentEnd).search(/[\r\n\u2028\u2029]/u);
  return lineBreak === -1 ? input : input.slice(0, contentEnd + lineBreak);
}
export function parseToolInput(text: string) {
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const document = parseDocument(`${text}\n`, {
        logLevel: "silent",
        schema: "json",
        strict: false,
      }),
      recoverable =
        document.errors.length > 0 &&
        document.errors.every(
          (error) => recoverableEndErrors.has(error.code) && error.pos[0] >= text.length,
        );
    return recoverable ? (document.toJS() as unknown) : undefined;
  }
}
