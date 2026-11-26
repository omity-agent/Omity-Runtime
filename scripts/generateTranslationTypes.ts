import { runTypesGenerator } from "i18next-cli";

import { defaultNamespace, sourceLanguage } from "../src/i18n/locale";

const checkOnly = process.argv.includes("--ci"),
  { changedFiles } = await runTypesGenerator(
    {
      extract: {
        defaultNS: defaultNamespace,
        input: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
        output: "locales/{{language}}/*/{{namespace}}.json",
      },
      locales: [sourceLanguage],
      types: {
        input: `locales/${sourceLanguage}/*/*.json`,
        output: "src/i18n/i18next.d.ts",
        resourcesFile: "src/i18n/messages.d.ts",
      },
    },
    { checkOnly },
  );
if (checkOnly && changedFiles.length > 0) {
  throw new Error(
    `Translation types are stale: ${changedFiles.join(", ")}. Run bun run i18n:types.`,
  );
}
