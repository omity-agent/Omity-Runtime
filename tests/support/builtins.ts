import type { McpDiagnosticLimits } from "../../src/infrastructure/mcp/configuration/declaration";
import type { BuiltInPreferences } from "../../src/infrastructure/toolbox/metadata";

const question = { description: "", minLength: 1 },
  preferences = { description: "", enabled: true };
export const fixtureTools = {
  choice: {
    ...preferences,
    name: "fixture_choice",
    parameters: {
      multiple: { description: "" },
      options: { description: "", itemDescription: "", minItems: 2, minLength: 1 },
      question,
    },
  },
  open_ended: { ...preferences, name: "fixture_question", parameters: { question } },
  update_title: {
    ...preferences,
    errors: { invalidLength: "Invalid fixture title" },
    name: "fixture_title",
    parameters: { title: { description: "", maxTokens: 20, minTokens: 1 } },
  },
} satisfies BuiltInPreferences;
export const fixtureDiagnosticLimits = {
  stderrBytes: 4096,
  stdoutBytes: 256,
  transportErrors: 4,
} satisfies McpDiagnosticLimits;
