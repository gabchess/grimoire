/**
 * Recorded mainnet transactions from test/fixtures/tx, read on the server.
 * The route serves these first, so the demo works with no key and no network.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAUSE_INFO, type Cause } from "./diagnose";
import type { RawTransaction, TxSource } from "./helius";
import type { ExampleChip } from "./types";

export interface Fixture {
  signature: string;
  slot: number;
  blockTime?: number | null;
  recorded_at: string;
  source: TxSource;
  expected_cause: Cause;
  explorer_url: string;
  response: RawTransaction;
}

export const FIXTURE_DIR = join(process.cwd(), "test", "fixtures", "tx");

let cache: Map<string, Fixture> | undefined;

export function recordedFixtures(): Map<string, Fixture> {
  cache ??= new Map(
    readdirSync(FIXTURE_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf8")) as Fixture)
      .map((fx) => [fx.signature, fx]),
  );
  return cache;
}

/** One example per cause, in the order causes are declared. */
export function exampleChips(): ExampleChip[] {
  const byCause = new Map<Cause, ExampleChip>();
  for (const fx of recordedFixtures().values()) {
    if (!byCause.has(fx.expected_cause)) {
      byCause.set(fx.expected_cause, { signature: fx.signature, cause: fx.expected_cause, title: CAUSE_INFO[fx.expected_cause].title });
    }
  }
  return (Object.keys(CAUSE_INFO) as Cause[]).flatMap((c) => byCause.get(c) ?? []);
}
