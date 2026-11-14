export async function elementAttributes(markup: string, selector: string) {
  const attributes: Record<string, string>[] = [];
  await new HTMLRewriter()
    .on(selector, {
      element(element) {
        attributes.push(Object.fromEntries(element.attributes));
      },
    })
    .transform(new Response(markup))
    .text();
  return attributes;
}
