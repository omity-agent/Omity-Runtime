import type { SessionDefinition } from "../../infrastructure/database/session/sessionDefinition";
import type { Settings } from "../../types";
import type { InitialMessagePair } from "../initialState";
import { createSessionStorage } from "../runtime/sessionStorage";
import { initialAttachmentTexts, type PendingAttachment } from "./contract";
import { saveAttachments } from "./storage";

export async function createSessionWithAttachments(options: {
  settings: Settings;
  sessionId: string;
  workspace: string;
  profiles: string[];
  definition: SessionDefinition;
  history: InitialMessagePair[];
  message: string;
  attachments: PendingAttachment[];
}) {
  const saved = await saveAttachments(
    options.settings,
    options.sessionId,
    initialAttachmentTexts(options.history, options.message),
    options.attachments,
  );
  try {
    createSessionStorage(
      options.sessionId,
      options.workspace,
      options.profiles,
      options.history.map(({ assistant, user }) => ({
        assistant: saved.rewrite(assistant),
        user: saved.rewrite(user),
      })),
      saved.rewrite(options.message),
      options.definition,
    );
  } catch (error) {
    await saved.discard();
    throw error;
  }
}
