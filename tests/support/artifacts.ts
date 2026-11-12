import { mkdirSync, mkdtempSync } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { removeDatabaseDirectory } from "../../src/infrastructure/database/sqlite/connection";
import { isProcessRunning } from "../../src/infrastructure/process/ownership";

const artifactsDirectory = join(tmpdir(), "omity-test");
export const testArtifactsRoot = join(artifactsDirectory, process.pid.toString());
export async function prepareTestArtifacts() {
  await mkdir(artifactsDirectory, { recursive: true });
  for (const entry of await readdir(artifactsDirectory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      /^[1-9]\d*$/u.test(entry.name) &&
      !isProcessRunning(Number(entry.name))
    ) {
      removeDatabaseDirectory(join(artifactsDirectory, entry.name));
    }
  }
  clearTestArtifacts();
  await mkdir(testArtifactsRoot, { recursive: true });
}
export function clearTestArtifacts() {
  removeDatabaseDirectory(testArtifactsRoot);
}
export function createTestDirectory(name: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) {
    throw new Error(`测试产物目录名称无效：${name}`);
  }
  mkdirSync(testArtifactsRoot, { recursive: true });
  return mkdtempSync(join(testArtifactsRoot, `${name}-`));
}
