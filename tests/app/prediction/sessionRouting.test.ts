import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { stringify } from "yaml";

import { AppController } from "../../../src/app/controller";
import { createApi } from "../../../src/app/http/handler";
import { settingsProfileNames } from "../../../src/infrastructure/configuration/settings/context";
import { writeSessionConfigurationRecord } from "../../../src/infrastructure/database/records/session/sessionConfiguration";
import { emptySessionDefinition } from "../../../src/infrastructure/database/session/sessionDefinition";
import { writeTestConfiguration } from "../../support/configuration";
import { scopedEnvironment } from "../../support/scopedEnvironment";
import { createPredictionFixture } from "./modelFixture";

test.each(["inherited", "model", "connection"] as const)(
  "prediction requests use the session snapshot and profile credentials with %s overrides",
  async (mode) => {
    await using value = await createPredictionFixture(),
      resources = new AsyncDisposableStack();
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
      connectionOverride = mode === "connection",
      overrides =
        mode === "inherited"
          ? { adapter: null, apiKeyEnv: null, baseURL: null, model: null }
          : {
              ...(connectionOverride
                ? { ...globalModel, baseURL: new URL("/override/v1", origin).href }
                : {}),
              model: "forecast-model",
            },
      { context } = writeTestConfiguration(value.home, {
        model: globalModel,
        prediction: { ...prediction, model: overrides },
      }),
      profileDirectory = join(context.userDirectory, "profiles", "selected");
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
    const definition = emptySessionDefinition();
    definition.prefix.model = {
      adapter: "completions",
      baseURL: new URL("/snapshot/v1", origin).href,
      model: "session-model",
    };
    writeSessionConfigurationRecord(
      value.database.db,
      value.sessionId,
      [...settingsProfileNames(context), "selected"],
      definition,
    );
    const controller = new AppController(value.home, { settingsContext: context });
    resources.defer(() => controller.close());
    const response = await createApi(controller, value.settings).request(
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
