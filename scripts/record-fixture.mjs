#!/usr/bin/env node
// Records one failed mainnet transaction as a test fixture.
// Usage: node scripts/record-fixture.mjs <signature> <expected_cause> [out_dir]
// Uses Helius when HELIUS_API_KEY is set, the public RPC otherwise. The key is never written to the file.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [signature, expectedCause, outDir = "test/fixtures/tx"] = process.argv.slice(2);
if (!signature || !expectedCause) {
  console.error("usage: node scripts/record-fixture.mjs <signature> <expected_cause> [out_dir]");
  process.exit(2);
}

const key = process.env.HELIUS_API_KEY;
const source = key ? "helius" : "public-rpc";
const url = key ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}` : "https://api.mainnet-beta.solana.com";
const request = {
  method: "getTransaction",
  params: [signature, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "finalized" }],
};

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...request }),
});
if (!res.ok) throw new Error(`${source} HTTP ${res.status}`);
const body = await res.json();
if (body.error || !body.result) throw new Error(`${source} error: ${JSON.stringify(body.error ?? "no result")}`);
if (body.result.meta?.err == null) throw new Error("transaction did not fail, refusing to record it");

const fixture = {
  signature,
  slot: body.result.slot,
  blockTime: body.result.blockTime,
  recorded_at: new Date().toISOString(),
  source,
  expected_cause: expectedCause,
  explorer_url: `https://explorer.solana.com/tx/${signature}`,
  request,
  response: body.result,
};
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${expectedCause}-${signature.slice(0, 8)}.json`);
writeFileSync(file, JSON.stringify(fixture, null, 2) + "\n");
console.log(`wrote ${file}`);
