import agent from "../../locales/zh-CN/engine/agent.json" with { type: "json" };
import checkpoint from "../../locales/zh-CN/engine/checkpoint.json" with { type: "json" };
import hooks from "../../locales/zh-CN/engine/hooks.json" with { type: "json" };
import runtime from "../../locales/zh-CN/engine/runtime.json" with { type: "json" };
import toolbox from "../../locales/zh-CN/engine/toolbox.json" with { type: "json" };
import configuration from "../../locales/zh-CN/platform/configuration.json" with { type: "json" };
import database from "../../locales/zh-CN/platform/database.json" with { type: "json" };
import errors from "../../locales/zh-CN/platform/errors.json" with { type: "json" };
import mcp from "../../locales/zh-CN/platform/mcp.json" with { type: "json" };
import network from "../../locales/zh-CN/platform/network.json" with { type: "json" };
import build from "../../locales/zh-CN/tooling/build.json" with { type: "json" };
import access from "../../locales/zh-CN/web/access.json" with { type: "json" };
import application from "../../locales/zh-CN/web/application.json" with { type: "json" };
import attachments from "../../locales/zh-CN/web/attachments.json" with { type: "json" };
import drafts from "../../locales/zh-CN/web/drafts.json" with { type: "json" };
import http from "../../locales/zh-CN/web/http.json" with { type: "json" };

export const serverCatalog = {
  access,
  agent,
  application,
  attachments,
  build,
  checkpoint,
  configuration,
  database,
  drafts,
  errors,
  hooks,
  http,
  mcp,
  network,
  runtime,
  toolbox,
};
