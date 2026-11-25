// eslint-disable-next-line import/no-unassigned-import -- This entry imports the global reset and Panda CSS layers.
import "./presentation/panda.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { i18nReady, localize } from "./i18n";
import { reportError } from "./services/errors";
import { createQueryClient } from "./services/remoteStore";

await i18nReady;
const root = document.querySelector("#root");
if (!root) {
  throw new Error(localize("diagnostics:runtime.rootMissing"));
}
const queryClient = createQueryClient();
createRoot(root, {
  onCaughtError: (error, errorInfo) => {
    reportError(error, { errorInfo });
  },
  onRecoverableError: (error, errorInfo) => {
    reportError(error, { errorInfo });
  },
  onUncaughtError: (error, errorInfo) => {
    reportError(error, { errorInfo });
  },
}).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
