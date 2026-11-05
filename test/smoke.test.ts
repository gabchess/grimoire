import { expect, test } from "vitest";
import { decodeTransactionFailure } from "@/lib/tx-decode";
test("success tx decodes as not failed", () => {
  expect(decodeTransactionFailure({ err: null, fee: 5000, logMessages: [] }).failed).toBe(false);
});
