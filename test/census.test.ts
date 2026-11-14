import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { census } from "@/lib/census";

const pool = JSON.parse(readFileSync(join(__dirname, "..", "data", "failed-tx-census-2026-11-05.json"), "utf8"));

test("census counts every recorded failure once and fees add up", () => {
  const c = census(pool.transactions);
  expect(c.total).toBe(pool.count);
  expect(c.rows.reduce((n, r) => n + r.count, 0)).toBe(c.total);
  expect(c.rows.reduce((n, r) => n + r.feeLamports, 0)).toBe(c.feeLamports);
  console.log(
    `census: ${c.named}/${c.total} named (${Math.round((100 * c.named) / c.total)}%), fees ${c.feeLamports / 1e9} SOL\n` +
      c.rows.map((r) => `  ${r.cause} ${r.count}`).join("\n"),
  );
});
