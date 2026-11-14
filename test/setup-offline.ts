import { beforeAll } from "vitest";

beforeAll(() => {
  globalThis.fetch = (async (input: unknown) => {
    throw new Error(`network is off in tests, blocked fetch to ${String(input)}`);
  }) as typeof fetch;
});
