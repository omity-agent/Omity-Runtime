import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { isPlainObject } from "es-toolkit";
import type { Plugin } from "vite";
import { parse } from "yaml";

export type YamlAssetOverrides = Readonly<Record<string, Readonly<Record<string, unknown>>>>;
export function createYamlAssets(overrides: YamlAssetOverrides = {}): Plugin {
  return {
    enforce: "pre",
    load: {
      filter: { id: /[/\\]settings[/\\]interface[/\\][\w-]+\.yaml$/u },
      async handler(path) {
        let data: unknown = parse(await readFile(path, "utf8"));
        const override = overrides[basename(path)];
        if (override) {
          if (!isPlainObject(data)) {
            throw new TypeError(`Cannot override fields of a non-mapping YAML asset: ${path}`);
          }
          data = { ...data, ...override };
        }
        return { code: `export default ${JSON.stringify(data)}`, moduleType: "js" };
      },
    },
    name: "settings-yaml",
  };
}
export const yamlAssets = createYamlAssets();
