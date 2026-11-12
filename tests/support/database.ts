import { join } from "node:path";

import { AgentDatabase } from "../../src/infrastructure/database/agentDatabase";
import { removeDatabaseDirectory } from "../../src/infrastructure/database/sqlite/connection";
import { createTestDirectory } from "./artifacts";

const dirs: string[] = [];
export const workspace = process.cwd();
export function makeDb() {
  return required(makeDatabases(1)[0], "测试数据库创建失败");
}
export function runOf(db: AgentDatabase, inputId: number) {
  return required(
    db.db
      .query<{ run_id: number }, [number]>("SELECT run_id FROM inputs WHERE id = ?")
      .get(inputId),
  ).run_id;
}
export function required<T>(value: T | null | undefined, message = "测试所需值不存在"): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}
export function makeDatabases(count: number) {
  const dir = createTestDirectory("database");
  dirs.push(dir);
  const path = join(dir, "app.sqlite");
  return Array.from({ length: count }, () => new AgentDatabase(path));
}
export function cleanupDatabaseDirs() {
  for (const dir of dirs.splice(0)) {
    removeDatabaseDirectory(dir);
  }
}
