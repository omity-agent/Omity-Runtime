import type { defaultNamespace } from "./locale";
import type Messages from "./messages";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNamespace;
    resources: Messages;
    strictInterpolationChecks: true;
    strictKeyChecks: true;
  }
}
