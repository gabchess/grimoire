import { CAUSE_INFO, diagnose, type Cause } from "./diagnose";
import type { RawTxMeta } from "./helius";

export interface CensusRow {
  cause: Cause;
  title: string;
  fix: string;
  count: number;
  feeLamports: number;
  sampleSignature: string;
}

export interface Census {
  total: number;
  feeLamports: number;
  /** Failures given a specific cause, not program_custom_error or unknown. */
  named: number;
  rows: CensusRow[];
}

const GENERIC: Cause[] = ["program_custom_error", "unknown"];

export function census(txs: { signature: string; meta: RawTxMeta }[]): Census {
  const rows = new Map<Cause, CensusRow>();
  let feeLamports = 0;
  for (const { signature, meta } of txs) {
    const d = diagnose(meta);
    feeLamports += meta.fee;
    const row = rows.get(d.cause) ?? { cause: d.cause, ...CAUSE_INFO[d.cause], count: 0, feeLamports: 0, sampleSignature: signature };
    row.count += 1;
    row.feeLamports += meta.fee;
    rows.set(d.cause, row);
  }
  const sorted = [...rows.values()].sort((a, b) => b.count - a.count);
  const named = sorted.filter((r) => !GENERIC.includes(r.cause)).reduce((n, r) => n + r.count, 0);
  return { total: txs.length, feeLamports, named, rows: sorted };
}
