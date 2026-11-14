import { beforeAll, expect, test } from "bun:test";

import { Wrench } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

import { Frame } from "../../../src/app/frontend/components/Details/Frame";
import { useToolAccessory } from "../../../src/app/frontend/components/Details/ToolAccessory";
import { CapabilityGroup } from "../../../src/app/frontend/components/NewSession/options/CapabilityGroup";
import { DisclosureProvider } from "../../../src/app/frontend/components/Transcript/disclosures";
import { i18nReady } from "../../../src/app/frontend/i18n";
import { elementAttributes } from "./elementAttributes";

const releaseDetail = () => {},
  registerDetail = () => releaseDetail,
  ignoreChange = () => {},
  hookOptions = [{ enable: true, id: "example-hook" }];
beforeAll(async () => {
  await i18nReady;
});
function RunningTool({ open }: { open: boolean }) {
  const accessory = useToolAccessory({
    callId: "running-tool",
    cancellable: true,
    onCancel: async () => {},
    phase: "running",
  });
  return (
    <DisclosureProvider registerDetail={registerDetail}>
      <Frame
        accessory={accessory}
        expandedInitially={open}
        icon={Wrench}
        label="Example tool"
        stateKey="running-tool"
        title="example"
        tone="tool"
      >
        <p>Tool output</p>
      </Frame>
    </DisclosureProvider>
  );
}
test.each([true, false])(
  "tool disclosure uses an accessible trigger with a separate stop control (open: %s)",
  async (open) => {
    const markup = renderToStaticMarkup(<RunningTool open={open} />),
      buttons = await elementAttributes(markup, "button");
    expect(buttons).toHaveLength(2);
    const [trigger, stop] = buttons;
    expect(trigger).toMatchObject({
      "aria-expanded": String(open),
      "aria-label": "Example tool",
      "data-part": "trigger",
      "data-scope": "collapsible",
      type: "button",
    });
    expect(trigger?.["aria-controls"]).toBeTruthy();
    if (open) {
      const contents = await elementAttributes(markup, '[data-part="content"]');
      expect(contents.map((content) => content["id"])).toEqual([trigger?.["aria-controls"]]);
    }
    expect(stop?.["aria-expanded"]).toBeUndefined();
    expect(stop?.["aria-controls"]).toBeUndefined();
    expect(stop?.["aria-label"]).toBeTruthy();
    expect(
      await elementAttributes(
        markup,
        "button button, summary button, summary a[href], summary input, summary select",
      ),
    ).toEqual([]);
    expect(await elementAttributes(markup, "summary")).toEqual([]);
  },
);
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
    fieldsets = await elementAttributes(markup, "fieldset"),
    legends = await elementAttributes(markup, "fieldset > legend"),
    switches = await elementAttributes(markup, 'fieldset input[type="checkbox"]');
  expect(fieldsets).toHaveLength(1);
  expect(legends).toHaveLength(1);
  expect(switches).toHaveLength(1);
  expect(switches[0]?.["id"]).toBeTruthy();
});
