import type { InitOptions, ResourceLanguage } from "i18next";

export const sourceLanguage = "zh-CN",
  defaultNamespace = "shell";

export function bundledTranslations<Catalog extends Record<string, ResourceLanguage>>(
  catalog: Catalog,
  defaultNS: (keyof Catalog & string) | false,
) {
  const namespaces = Object.keys(catalog).filter((key): key is keyof Catalog & string =>
    Object.hasOwn(catalog, key),
  );
  return {
    namespaces,
    options: {
      defaultNS,
      fallbackLng: sourceLanguage,
      initAsync: false,
      interpolation: { escapeValue: false },
      lng: sourceLanguage,
      ns: namespaces,
      resources: { [sourceLanguage]: catalog },
      supportedLngs: [sourceLanguage],
    } satisfies InitOptions,
  };
}
