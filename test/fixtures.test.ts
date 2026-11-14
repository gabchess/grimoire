import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { CAUSES, diagnose } from "@/lib/diagnose";
import type { RawTransaction } from "@/lib/helius";

interface Fixture {
  signature: string;
  slot: number;
  recorded_at: string;
  source: "helius" | "public-rpc";
  expected_cause: string;
  response: RawTransaction;
}

const dir = join(__dirname, "fixtures", "tx");
const fixtures: Fixture[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

test("at least 5 recorded fixtures with 5 distinct causes", () => {
  expect(fixtures.length).toBeGreaterThanOrEqual(5);
  expect(new Set(fixtures.map((f) => f.expected_cause)).size).toBeGreaterThanOrEqual(5);
});

describe.each(fixtures.map((f) => [f.expected_cause, f.signature.slice(0, 8), f] as const))(
  "%s %s",
  (_cause, _sig, fx) => {
    test("provenance is complete and the tx really failed on mainnet", () => {
      expect(CAUSES).toContain(fx.expected_cause);
      expect(fx.response.transaction.signatures[0]).toBe(fx.signature);
      expect(fx.response.slot).toBe(fx.slot);
      expect(fx.response.meta?.err).not.toBeNull();
      expect(["helius", "public-rpc"]).toContain(fx.source);
      expect(Number.isNaN(Date.parse(fx.recorded_at))).toBe(false);
    });

    test("diagnoses the expected cause, proven by a line from the tx itself", () => {
      const d = diagnose(fx.response.meta!);
      expect(d.cause).toBe(fx.expected_cause);
      const proof = [...(fx.response.meta!.logMessages ?? []), JSON.stringify(fx.response.meta!.err)];
      expect(proof).toContain(d.evidence);
    });
  },
);
