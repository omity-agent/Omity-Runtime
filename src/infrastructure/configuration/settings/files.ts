import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { deepmergeCustom } from "deepmerge-ts";
import { config as loadDotenv } from "dotenv";
import { isPlainObject as isRecord } from "es-toolkit";
import untildify from "untildify";

import { localize } from "../../../i18n/server";
import {
  type PlaceholderOptions,
  readSettingsYamlFile,
  resolvePlaceholders,
} from "../placeholders";
import type { SettingsContext } from "./context";

const mergeSettings = deepmergeCustom({
  filterValues: false,
  mergeArrays: false,
  mergeMaps: false,
  mergeRecords(values, utils, meta) {
    const reset = values.findLastIndex((value) => Object.keys(value).length === 0);
    return utils.defaultMergeFunctions.mergeRecords(values.slice(Math.max(0, reset)), utils, meta);
  },
  mergeSets: false,
});
interface LayeredSettingsFile {
  path: string;
  value: unknown;
}
type SettingsScope = "global" | "profile";
type OverrideTransform = (value: unknown, override: unknown, directory: string) => unknown;
interface LayeredSettingsTransforms {
  beforePlaceholders?: (value: unknown) => unknown;
  override?: OverrideTransform;
}
export function userDataDirectory() {
  const configured = process.env["OMITY_HOME"];
  return configured ? resolve(untildify(configured)) : join(homedir(), ".omity");
}
function userEnvironmentPath() {
  return join(userDataDirectory(), ".env");
}
export function loadUserEnvironment(path = userEnvironmentPath()) {
  if (!existsSync(path)) {
    return;
  }
  const result = loadDotenv({ override: false, path, quiet: true });
  if (result.error) {
    throw new Error(localize("configuration:settings.userEnvironmentLoadFailed", { path }), {
      cause: result.error,
    });
  }
}
export function userSettingsDirectory() {
  return join(userDataDirectory(), "settings");
}
export function readLayeredSettingsYaml(
  context: SettingsContext,
  scope: SettingsScope,
  relativePath: string,
  placeholders: Omit<PlaceholderOptions, "source"> = {},
  transforms: LayeredSettingsTransforms = {},
): LayeredSettingsFile | undefined {
  const defaultPath = bundledYamlPath(context, relativePath),
    overrideDirectories =
      scope === "global"
        ? [context.userDirectory]
        : context.profiles.map(({ directory }) => directory),
    layers = [
      { override: false, path: defaultPath },
      ...overrideDirectories.map((directory) => ({
        override: true,
        path: resolve(directory, relativePath),
      })),
    ]
      .filter(({ path }) => existsSync(path))
      .map((layer) => {
        const file = readSettingsYamlFile(layer.path);
        return Object.assign(layer, file, {
          empty: file.empty || (isRecord(file.value) && Object.keys(file.value).length === 0),
        });
      });
  if (layers.length === 0) {
    return undefined;
  }
  let value: unknown;
  for (const layer of layers) {
    if (!layer.empty) {
      value = value === undefined ? layer.value : mergeSettings(value, layer.value);
    }
  }
  const source = layers.at(-1)?.path;
  if (!source) {
    throw new Error(
      localize("configuration:settings.layerParseFailed", {
        path: relativePath,
      }),
    );
  }
  if (value === undefined) {
    value = {};
  }
  const prepared = transforms.beforePlaceholders ? transforms.beforePlaceholders(value) : value;
  let resolved = resolvePlaceholders(prepared, {
    ...placeholders,
    source,
  });
  if (transforms.override) {
    for (const layer of layers.toReversed()) {
      if (layer.override && !layer.empty) {
        resolved = transforms.override(resolved, layer.value, dirname(layer.path));
      }
    }
  }
  return {
    path: source,
    value: resolved,
  };
}
export function bundledYamlPath(context: SettingsContext, relativePath: string) {
  return resolve(context.bundledDirectory, "defaults", relativePath);
}
export function requireLayeredSettingsYaml(
  context: SettingsContext,
  scope: SettingsScope,
  relativePath: string,
  placeholders: Omit<PlaceholderOptions, "source"> = {},
  transforms: LayeredSettingsTransforms = {},
) {
  const file = readLayeredSettingsYaml(context, scope, relativePath, placeholders, transforms);
  if (!file) {
    throw new Error(
      localize("configuration:settings.fileMissing", {
        path: bundledYamlPath(context, relativePath),
      }),
    );
  }
  return file;
}
export function resolveLayeredSettingsText(
  context: SettingsContext,
  scope: SettingsScope,
  relativePath: string,
) {
  const directories =
      scope === "global"
        ? [context.bundledDirectory, context.userDirectory]
        : [context.bundledDirectory, ...context.profiles.map(({ directory }) => directory)],
    path = directories
      .map((directory) => resolve(directory, relativePath))
      .findLast((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (!path) {
    throw new Error(
      localize("configuration:settings.textFileMissing", {
        path: relativePath,
      }),
    );
  }
  return path;
}
