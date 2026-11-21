import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { stringify } from "yaml";

import { AppController } from "../../../src/app/controller";
import { createApi } from "../../../src/app/http/handler";
import { createSettingsContext } from "../../../src/infrastructure/configuration/settings/context";
import { writeSessionConfigurationRecord } from "../../../src/infrastructure/database/records/session/sessionConfiguration";
import { emptySessionDefinition } from "../../../src/infrastructure/database/session/sessionDefinition";
import { writeTestConfiguration } from "../../support/configuration";
import { scopedEnvironment } from "../../support/scopedEnvironment";
import { createPredictionFixture } from "./modelFixture";

test.each(["inherited", "model", "connection"] as const)(
  "prediction requests use the session snapshot and profile credentials with %s overrides",
  async (mode) => {
    await using value = await createPredictionFixture();
    await using resources = new AsyncDisposableStack();
    const { prediction } = value.settings;
    if (
      !prediction?.enabled ||
      prediction.model.adapter !== "completions" ||
      !prediction.model.baseURL
    ) {
      throw new Error("Prediction fixture must use a local completions endpoint");
    }
    const origin = prediction.model.baseURL,
      globalKey = `GLOBAL_${randomUUID()}`,
      globalModel = {
        ...prediction.model,
        apiKeyEnv: globalKey,
        baseURL: new URL("/global/v1", origin).href,
        model: "global-model",
      },
      defaults = writeTestConfiguration(value.home, { modelYaml: stringify(globalModel) }),
      context = createSettingsContext(value.home, join(value.home, "user-settings"), []),
      profileDirectory = join(context.userDirectory, "profiles", "selected"),
      connectionOverride = mode === "connection",
      overrides =
        mode === "inherited"
          ? { adapter: null, apiKeyEnv: null, baseURL: null, model: null }
          : {
              ...(connectionOverride
                ? { ...globalModel, baseURL: new URL("/override/v1", origin).href }
                : {}),
              model: "forecast-model",
            };
    resources.use(scopedEnvironment({ [globalKey]: "global-credential" }));
    mkdirSync(profileDirectory, { recursive: true });
    writeFileSync(
      join(profileDirectory, "model.yaml"),
      stringify({
        ...prediction.model,
        baseURL: new URL("/changed/v1", origin).href,
        model: "changed-profile-model",
      }),
    );
    appendFileSync(
      join(defaults, "main.yaml"),
      stringify({ prediction: { ...prediction, model: overrides } }),
    );
    const definition = emptySessionDefinition();
    definition.prefix.model = {
      adapter: "completions",
      baseURL: new URL("/snapshot/v1", origin).href,
      model: "session-model",
    };
    writeSessionConfigurationRecord(value.database.db, value.sessionId, ["selected"], definition);
    const controller = new AppController(value.home, { settingsContext: context });
    resources.defer(() => controller.close());
    const response = await createApi(controller).request(
      `/api/sessions/${value.sessionId}/predictions`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ predictions: value.replies });
    expect(value.connections).toEqual([
      {
        authorization: `Bearer ${connectionOverride ? "global-credential" : "local-test"}`,
        url: new URL(
          `${connectionOverride ? "/override" : "/snapshot"}/v1/chat/completions`,
          origin,
        ).href,
      },
    ]);
    expect(value.requests[0]?.["model"]).toBe(
      mode === "inherited" ? "session-model" : "forecast-model",
    );
  },
);
