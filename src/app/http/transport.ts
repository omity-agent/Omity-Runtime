import type { Settings } from "../../types";
import type { AccessService } from "../access/service";
import type { AppController } from "../controller";
import { createApi } from "./handler";
import { createStaticApp } from "./static";

export function createHttpServer({
  access,
  controller,
  hostname,
  port,
  settings,
  staticRoot,
}: {
  access: AccessService;
  controller: AppController;
  hostname: string;
  port: number;
  settings: Pick<Settings, "attachments" | "server">;
  staticRoot: string;
}) {
  const api = createApi(controller, settings, access),
    assets = createStaticApp(staticRoot);
  return Bun.serve({
    development: false,
    fetch(request, server) {
      return new URL(request.url).pathname.startsWith("/api")
        ? api.fetch(request, { remoteAddress: server.requestIP(request)?.address })
        : assets.fetch(request);
    },
    hostname,
    idleTimeout: settings.server.idleTimeoutSeconds,
    maxRequestBodySize: Number.MAX_SAFE_INTEGER,
    port,
  });
}
