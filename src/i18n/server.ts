import { createInstance } from "i18next";

import { bundledTranslations } from "./locale.ts";
import { serverCatalog } from "./serverCatalog.ts";

const { namespaces, options } = bundledTranslations(serverCatalog, false);
export const serverI18n = createInstance();
await serverI18n.init(options);
export const localize = serverI18n.getFixedT(null, namespaces);
