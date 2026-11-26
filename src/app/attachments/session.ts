import type { AgentDatabase } from "../../infrastructure/database/agentDatabase";
import type { SessionDefinition } from "../../infrastructure/database/session/sessionDefinition";
import type { Settings } from "../../types";
import type { InitialMessagePair } from "../initialState";
import { createSessionStorage } from "../runtime/sessions/persistence";
import { initialAttachmentTexts, type PendingAttachment } from "./contract";
import { withSavedAttachments } from "./uploads";

export function createSessionWithAttachments(options: {
  settings: Settings;
  database: AgentDatabase;
  sessionId: string;
  workspace: string;
  profiles: string[];
  definition: SessionDefinition;
  history: InitialMessagePair[];
  message: string;
  attachments: PendingAttachment[];
}) {
  return withSavedAttachments(
    options.settings.attachments,
    options.sessionId,
    initialAttachmentTexts(options.history, options.message),
    options.attachments,
    (rewrite) =>
      createSessionStorage(
        options.database,
        options.sessionId,
        options.workspace,
        options.profiles,
        options.history.map(({ assistant, user }) => ({
          assistant: rewrite(assistant),
          user: rewrite(user),
        })),
        rewrite(options.message),
        options.definition,
      ),
  );
}
