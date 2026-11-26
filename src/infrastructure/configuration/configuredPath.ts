import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

import untildify from "untildify";

export function resolveConfiguredPath(root: string, path: string) {
  const expanded = untildify(path);
  return isAbsolute(expanded) ? resolve(expanded) : resolve(root, expanded);
}
export function abbreviateHomePath(path: string) {
  if (!isAbsolute(path)) {
    return path;
  }
  const fromHome = relative(homedir(), path);
  if (fromHome === "") {
    return "~";
  }
  if (fromHome === ".." || fromHome.startsWith(`..${sep}`) || isAbsolute(fromHome)) {
    return path;
  }
  return `~/${fromHome.replaceAll("\\", "/")}`;
}
