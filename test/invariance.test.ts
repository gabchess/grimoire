import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { diagnose } from "@/lib/diagnose";
import type { RawTxMeta } from "@/lib/helius";

// Real logs vary in ways that must not change the cause: other programs log
// before the failure, and the runtime truncates long logs at the tail.
const dir = join(__dirname, "fixtures", "tx");
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as { expected_cause: string; signature: string; response: { meta: RawTxMeta } });

const NOISE = [
  "Program ComputeBudget111111111111111111111111111111 invoke [1]",
  "Program ComputeBudget111111111111111111111111111111 success",
  "Program log: Instruction: SetSlippage max_slippage_bps=50",
  "Program log: user error handling enabled",
];

function withLogs(meta: RawTxMeta, logs: string[]): RawTxMeta {
  return { ...meta, logMessages: logs };
}

describe.each(fixtures.map((f) => [f.expected_cause, f.signature.slice(0, 8), f] as const))("%s %s", (_c, _s, fx) => {
  const meta = fx.response.meta;
  const logs = meta.logMessages ?? [];

  test("cause holds when unrelated programs log first", () => {
    expect(diagnose(withLogs(meta, [...NOISE, ...logs])).cause).toBe(fx.expected_cause);
  });

  test("cause holds when the log tail after the first failure is truncated", () => {
    const first = logs.findIndex((l) => / failed: /.test(l));
    const cut = first >= 0 ? [...logs.slice(0, first + 1), "Log truncated"] : logs;
    expect(diagnose(withLogs(meta, cut)).cause).toBe(fx.expected_cause);
  });
});
