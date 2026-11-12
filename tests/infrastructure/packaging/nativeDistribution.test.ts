import { expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { z } from "zod";

import { executableBuild, frontendOutput } from "../../../settings/bundling";
import { createTestDirectory } from "../../support/artifacts";

test("AOT executables read embedded settings, schemas and HTML outside the workspace", async () => {
  const directory = createTestDirectory("native-distribution"),
    executable = join(directory, "resource-probe.exe"),
    frontend = resolve(
      executableBuild.root,
      "tests/app/frontend/composition/applicationShell.html",
    ),
    build = await Bun.build({
      ...executableBuild,
      compile: {
        ...executableBuild.compile,
        assets: [
          ...executableBuild.compile.assets.filter((path) => path !== frontendOutput),
          frontend,
        ],
        outfile: executable,
      },
      entrypoints: [resolve(import.meta.dir, "resourceProbe.ts")],
    });
  expect(build.success).toBe(true);
  const child = Bun.spawn([executable], {
      cwd: directory,
      stderr: "pipe",
      stdout: "pipe",
    }),
    [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
  expect(code, stderr).toBe(0);
  const report = z
    .object({
      frontend: z.string(),
      settings: z.string(),
      standalone: z.boolean(),
      tables: z.array(z.string()),
    })
    .parse(JSON.parse(stdout));
  expect(report).toMatchObject({
    frontend: await Bun.file(frontend).text(),
    settings: await Bun.file(resolve(executableBuild.root, "settings/main.yaml")).text(),
    standalone: true,
  });
  expect(report.tables).toContain("messages");
  expect(report.tables).toContain("sessions");
}, 30_000);
