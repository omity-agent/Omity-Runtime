import { resolve } from "node:path";

export function applicationAssetPath(root: string, sourcePath: string) {
  return Bun.isStandaloneExecutable
    ? resolve(import.meta.dir, "../..", sourcePath)
    : resolve(root, sourcePath);
}
