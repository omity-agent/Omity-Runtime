import { beforeAll, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { CapabilityGroup } from "../../../../src/app/frontend/components/NewSession/options/CapabilityGroup";
import { ModelInput } from "../../../../src/app/frontend/components/NewSession/options/ModelInput";
import { ProfilePicker } from "../../../../src/app/frontend/components/NewSession/ProfilePicker";
import { WorkspacePicker } from "../../../../src/app/frontend/components/NewSession/WorkspacePicker";
import { i18nReady } from "../../../../src/app/frontend/i18n";

const ignoreChange = () => {},
  pickWorkspace = () => Promise.resolve(null),
  recentWorkspaces: string[] = [],
  availableProfiles = ["local"],
  hookOptions = [{ enable: true, id: "example-hook" }];
beforeAll(async () => {
  await i18nReady;
});
async function elements(markup: string, selector: string) {
  const attributes: Record<string, string>[] = [],
    rewriter = new HTMLRewriter().on(selector, {
      element(element) {
        attributes.push(Object.fromEntries(element.attributes));
      },
    });
  await rewriter.transform(new Response(markup)).text();
  return attributes;
}
test("session setup fields have semantic names and associated native labels", async () => {
  const markup = renderToStaticMarkup(
      <form>
        <WorkspacePicker
          onChange={ignoreChange}
          onPick={pickWorkspace}
          recentWorkspaces={recentWorkspaces}
          workspace="F:/workspace/example"
        />
        <ProfilePicker available={availableProfiles} onChange={ignoreChange} selected="local" />
        <ModelInput disabled={false} model="example-model" onChange={ignoreChange} />
      </form>,
    ),
    controls = await elements(markup, "input, select"),
    labels = await elements(markup, "label");
  expect(controls.map((control) => control["name"])).toEqual(["workspace", "profile", "model"]);
  for (const control of controls) {
    expect(control["id"]).toBeTruthy();
    expect(labels.filter((label) => label["for"] === control["id"])).toHaveLength(1);
  }
});
test("hook switches belong to a labelled fieldset instead of a single-control field", async () => {
  const markup = renderToStaticMarkup(
      <CapabilityGroup
        disabled={false}
        emptyLabel="当前配置没有 Hook"
        label="Hooks"
        onChange={ignoreChange}
        options={hookOptions}
      />,
    ),
    fieldsets = await elements(markup, "fieldset"),
    legends = await elements(markup, "fieldset > legend"),
    switches = await elements(markup, 'fieldset input[type="checkbox"]');
  expect(fieldsets).toHaveLength(1);
  expect(legends).toHaveLength(1);
  expect(switches).toHaveLength(1);
  expect(switches[0]?.["id"]).toBeTruthy();
});
