export type DomainErrorCode =
  | "BUILT_IN_SELECTION_INVALID"
  | "HOOK_SELECTION_INVALID"
  | "MCP_SELECTION_INVALID"
  | "PROMPT_SELECTION_INVALID"
  | "ASK_USER_ANSWER_INVALID"
  | "CONTROL_NOT_READY"
  | "SESSION_NOT_FOUND"
  | "SESSION_CONFLICT"
  | "HOST_LEASE_CONFLICT"
  | "INPUT_CLAIM_CONFLICT"
  | "SESSION_PROFILE_BUSY"
  | "TOOL_NOT_RUNNING"
  | "FORK_MESSAGE_NOT_FOUND"
  | "ATTACHMENT_INVALID"
  | "ATTACHMENT_TOO_LARGE";
export class DomainError extends Error {
  override readonly name = "DomainError";
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}
