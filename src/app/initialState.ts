import { AIMessage, HumanMessage } from "@langchain/core/messages";

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
}
export function initialHistory(history: InitialMessagePair[]) {
  return history.flatMap(({ user, assistant }) => [
    new HumanMessage(user),
    new AIMessage(assistant),
  ]);
}
