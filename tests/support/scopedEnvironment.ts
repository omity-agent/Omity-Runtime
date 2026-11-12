export function scopedEnvironment(values: Readonly<Record<string, string | undefined>>) {
  using restored = new DisposableStack();
  for (const [name, value] of Object.entries(values)) {
    const previous = process.env[name];
    restored.defer(() => {
      assignVariable(name, previous);
    });
    assignVariable(name, value);
  }
  return restored.move();
}
function assignVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
