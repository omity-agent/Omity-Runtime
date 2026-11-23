import { createInstance, type ParseKeys, type TOptions } from "i18next";

import { serverCatalog } from "./serverCatalog";

type ServerNamespace = keyof typeof serverCatalog;
const instance = createInstance(),
  namespaces = Object.keys(serverCatalog).filter((key): key is ServerNamespace =>
    Object.hasOwn(serverCatalog, key),
  );
void instance.init({
  fallbackLng: "zh-CN",
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
  lng: "zh-CN",
  ns: namespaces,
  resources: { "zh-CN": serverCatalog },
});
export function localize(
  key: Extract<ParseKeys<ServerNamespace[]>, `${ServerNamespace}:${string}`>,
  options: TOptions = {},
): string {
  return instance.t(key, {
    ...options,
    ns: namespaces,
    returnDetails: false,
    returnObjects: false,
  });
}
