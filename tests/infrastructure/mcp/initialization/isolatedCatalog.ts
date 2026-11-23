import { rmSync } from "node:fs";
import { join } from "node:path";

import { Logger } from "../../../../src/infrastructure/logging/logger";
import { McpLoadError } from "../../../../src/infrastructure/mcp/failures/reportConstruction";
import { loadMcp } from "../../../../src/infrastructure/mcp/tools/catalog";
import { createTestDirectory } from "../../../support/artifacts";
import { fixtureDiagnosticLimits } from "../../../support/builtins";
import { testProfiles, writeFixtureYaml } from "../../../support/configuration";

export const failingStartupPath = join(import.meta.dir, "failingStartup.ts");
export function configureFailure(profileDirectory: string, mcpServers: Record<string, unknown>) {
  writeFixtureYaml(profileDirectory, "toolbox", {
    diagnostics: fixtureDiagnosticLimits,
    mcpServers,
    stdio: { restart: { delayMs: 0, maxAttempts: 1 } },
  });
}
export async function failedCatalog(mcpServers: Record<string, unknown>) {
  const root = createTestDirectory("mcp-failure-diagnostics");
  try {
    const { context, profileDirectory } = testProfiles(root);
    configureFailure(profileDirectory, mcpServers);
    try {
      const loaded = await loadMcp(root, new Logger("error", true), context, { cwd: root });
      await loaded.close();
    } catch (error) {
      if (error instanceof McpLoadError) {
        return { failure: error, root };
      }
      throw error;
    }
    throw new Error("MCP startup unexpectedly succeeded");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}
