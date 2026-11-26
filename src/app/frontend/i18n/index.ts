import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import { bundledTranslations, defaultNamespace } from "../../../i18n/locale";
import { browserCatalog } from "./browserCatalog";

const { namespaces, options } = bundledTranslations(browserCatalog, defaultNamespace);
export const browserI18n = createInstance(),
  i18nReady = browserI18n.use(initReactI18next).init(options),
  localize = browserI18n.getFixedT(null, namespaces);
