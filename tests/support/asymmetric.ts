import { expect } from "bun:test";

export const anyValue = (type: Parameters<typeof expect.any>[0]): unknown => expect.any(type);
export const containingItems = (items: unknown[]): unknown => expect.arrayContaining(items);
export const partialObject = (value: Record<string, unknown>): unknown =>
  expect.objectContaining(value);
export const containingText = (text: string): unknown => expect.stringContaining(text);
