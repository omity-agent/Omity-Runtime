import { afterAll } from "bun:test";

import { fixtureProxyBypass } from "../settings/verification";
import { clearTestArtifacts, testArtifactsRoot } from "./support/artifacts";

const proxyBypass = [process.env["NO_PROXY"], process.env["no_proxy"], ...fixtureProxyBypass]
  .filter(Boolean)
  .join(",");
process.env["NO_PROXY"] = proxyBypass;
process.env["no_proxy"] = proxyBypass;
clearTestArtifacts();
process.env["TEMP"] = testArtifactsRoot;
process.env["TMP"] = testArtifactsRoot;
process.env["TMPDIR"] = testArtifactsRoot;
process.env["OMITY_HOME"] = `${testArtifactsRoot}/user-data`;
afterAll(clearTestArtifacts);
process.once("exit", clearTestArtifacts);
