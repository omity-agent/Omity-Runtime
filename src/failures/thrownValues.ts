export function describeThrownValue(value: unknown, serialized: unknown) {
  return {
    details: { value: nonErrorValue(value, serialized) },
    message: String(value),
    name: valueName(value),
  };
}
function nonErrorValue(value: unknown, serialized: unknown): unknown {
  if (value === null || ["string", "boolean"].includes(typeof value)) {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "bigint" || typeof value === "symbol") {
    return String(value);
  }
  if (value === undefined) {
    return "[undefined]";
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  return serialized;
}
function valueName(value: unknown) {
  if (value === null) {
    return "null";
  }
  if (typeof value !== "object") {
    return typeof value;
  }
  const { constructor } = value;
  return typeof constructor === "function" && constructor.name ? constructor.name : "Object";
}
