import { httpServerOptions } from "../../../settings/networking";
import type { AccessService } from "../access/service";
import type { AppController } from "../controller";
import { createApi } from "./handler";
import { createStaticApp } from "./static";

export function createHttpServer({
  access,
  controller,
  hostname,
  port,
  staticRoot,
}: {
  access: AccessService;
  controller: AppController;
  hostname: string;
  port: number;
  staticRoot: string;
}) {
  const api = createApi(controller, access),
    assets = createStaticApp(staticRoot);
  return Bun.serve({
    ...httpServerOptions,
    fetch(request, server) {
      return new URL(request.url).pathname.startsWith("/api")
        ? api.fetch(request, { remoteAddress: server.requestIP(request)?.address })
        : assets.fetch(request);
    },
    hostname,
    port,
  });
}
