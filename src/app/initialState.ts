import { AIMessage, HumanMessage } from "@langchain/core/messages";

import type { PromptSelection } from "../infrastructure/configuration/prompts/selection";

export interface InitialMessagePair {
  user: string;
  assistant: string;
}
export interface InitialSessionState {
  builtInOverrides?: Record<string, boolean>;
  draftRevision?: number;
  history: InitialMessagePair[];
  hookOverrides?: Record<string, boolean>;
  mcpOverrides?: Record<string, boolean>;
  message: string;
  model?: string;
  promptSelection?: PromptSelection;
}
export function initialHistory(history: InitialMessagePair[]) {
  return history.flatMap(({ user, assistant }) => [
    new HumanMessage(user),
    new AIMessage(assistant),
  ]);
}
