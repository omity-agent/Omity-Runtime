import type { browserCatalog } from "../app/frontend/i18n/browserCatalog";
import type { serverCatalog } from "./serverCatalog";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "shell";
    resources: typeof serverCatalog & typeof browserCatalog;
    strictKeyChecks: true;
  }
}
