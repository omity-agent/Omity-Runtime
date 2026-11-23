import { type ParseKeys, t, type TOptions, use } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next, useTranslation as useReactTranslation } from "react-i18next";

import { browserCatalog } from "./browserCatalog";

type BrowserNamespace = keyof typeof browserCatalog;
const namespaces = Object.keys(browserCatalog).filter((key): key is BrowserNamespace =>
  Object.hasOwn(browserCatalog, key),
);
export const i18nReady = use(LanguageDetector)
  .use(initReactI18next)
  .init({
    defaultNS: "shell",
    fallbackLng: "zh-CN",
    interpolation: {
      escapeValue: false,
    },
    ns: namespaces,
    resources: { "zh-CN": browserCatalog },
  });
export function useTranslation() {
  return useReactTranslation(namespaces);
}
export function localize(
  key: Extract<ParseKeys<BrowserNamespace[]>, `${BrowserNamespace}:${string}`>,
  options: TOptions = {},
): string {
  return t(key, { ...options, ns: namespaces, returnDetails: false, returnObjects: false });
}
