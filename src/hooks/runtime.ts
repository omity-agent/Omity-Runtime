import type { Database } from "bun:sqlite";

import type { ToolCall, ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { isPlainObject } from "es-toolkit";

import { localize } from "../i18n/server";
import type { Logger } from "../infrastructure/logging/logger";
import type { HookRule, HookWhen } from "../types";
import { createHookCallId, hookCallDetails } from "./storage/calls";
import { type HookToolOutput, readToolOutput } from "./storage/outputs";
import { consumeHookUsage } from "./storage/usage";
import { resolveHookInput } from "./variables";

interface HookExecutionOptions {
  consume: (hookId: string, limit: number) => Promise<boolean>;
  invoke: (call: ToolCall) => Promise<ToolMessage>;
  toolOutputs: readonly HookToolOutput[];
}
export class HookRuntime {
  private readonly toolNames: Set<string>;
  constructor(
    readonly rules: HookRule[],
    tools: StructuredToolInterface[],
    private readonly db: Database,
    private readonly logger: Logger,
    readonly sessionId: string,
    private readonly workspace: string,
    readonly freeformToolParameters: ReadonlyMap<string, string> = new Map(),
    private readonly sessionDirectory?: string,
  ) {
    this.toolNames = new Set(tools.map((tool) => tool.name));
    if (this.toolNames.size !== tools.length) {
      throw new Error(localize("hooks:runtime.duplicateToolName"));
    }
    for (const rule of rules) {
      if (!Number.isInteger(rule.runLimit) || rule.runLimit < -1) {
        throw new Error(localize("hooks:runtime.runLimitInvalid", { hookId: rule.id }));
      }
      if (rule.enable !== false) {
        this.requireTool(rule.tool, `Hook ${rule.id}`);
        if (rule.target !== "agent") {
          this.requireTool(rule.target, localize("hooks:runtime.targetLabel", { hookId: rule.id }));
        }
      }
    }
  }
  matching(target: string, when: HookWhen) {
    return this.rules.filter(
      (rule) => rule.enable !== false && rule.target === target && rule.when === when,
    );
  }
  consume(hookId: string, limit: number) {
    return consumeHookUsage(this.db, this.sessionId, hookId, limit);
  }
  async execute(rule: HookRule, sourceId: string, threadId: string, options: HookExecutionOptions) {
    if (rule.enable === false || !(await options.consume(rule.id, rule.runLimit))) {
      return null;
    }
    const details = hookCallDetails(rule, sourceId),
      call = this.resolveCall(
        rule,
        createHookCallId(this.sessionId, threadId, details),
        options.toolOutputs,
      );
    this.logger.debug(localize("hooks:runtime.nodeStarted"), {
      hookId: rule.id,
      sourceId,
      trigger: details.trigger,
    });
    const output = await options.invoke(call);
    return { call, output, value: readToolOutput(output) };
  }
  private resolveCall(rule: HookRule, id: string, toolOutputs: readonly HookToolOutput[]) {
    const input = resolveHookInput(rule, {
        cwd: this.workspace,
        session: this.sessionDirectory,
        toolOutputs,
      }),
      freeform = this.freeformToolParameters.has(rule.tool),
      call = { id, name: rule.tool, type: "tool_call" as const };
    if (freeform && typeof input === "string") {
      return { ...call, args: { input }, isCustomTool: true };
    }
    if (!freeform && isPlainObject(input)) {
      return { ...call, args: input };
    }
    throw new TypeError(
      localize(freeform ? "hooks:runtime.textInputRequired" : "hooks:runtime.objectInputRequired", {
        hookId: rule.id,
        toolName: rule.tool,
      }),
    );
  }
  private requireTool(name: string, description: string) {
    if (!this.toolNames.has(name)) {
      throw new Error(
        localize("hooks:runtime.toolMissing", { source: description, toolName: name }),
      );
    }
  }
}
