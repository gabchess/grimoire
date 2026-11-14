# Grimoire: Solana Transaction Doctor

Paste a failed Solana mainnet transaction signature. Grimoire fetches it, and plain code names the root cause, the fix and the log line that proves it. No AI model runs anywhere in the app.

Example: a pump.fun buy that logged `Error Code: BuySlippageBelowMinTokensOut. Error Number: 6042.` comes back as "Slippage tolerance exceeded" in instruction #14 (Solana Explorer numbering), with the fee it still paid and a fix.

---

## How it works

1. **Recorded fixtures first.** If the signature is one of the real failed transactions in `test/fixtures/tx`, the route answers from that file with no network call. The demo works offline and with no keys.
2. **Fetch.** Otherwise the server route calls `getTransaction` through Helius when `HELIUS_API_KEY` is set, and through the public Solana RPC when it is not (`src/lib/helius.ts`).
3. **Diagnose.** `src/lib/diagnose.ts` maps `meta.err` and the program logs to one cause. Error codes are looked up by the failing program id, because the same code means different things in different programs.
4. **Cross-check.** With a Helius key, the route also asks Helius Parsed Events for its decoded error and reports whether it agrees with our error code.

Wallet autopsy: paste an address and `POST /api/autopsy` groups its recent failed transactions by cause, with the fees they burned. With `HELIUS_API_KEY` this is one `getTransactionsForAddress` call with `filters.status: "failed"`. Without a key it scans the last 100 signatures on the public RPC and reads at most 10 failed ones, to stay under the public rate limit.

The page also shows a failure census: plain code run over 369 real failed mainnet transactions recorded on 2026-11-05 (`data/failed-tx-census-2026-11-05.json`). The census is computed on the server at build time.

---

## Quickstart

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click one of the example chips, or paste any failed mainnet signature.

```bash
npm test     # offline test suite, network calls are blocked
```

---

## Environment variables

All optional.

```
# Use Helius for lookups and turn on the Parsed Events cross-check. Server side only.
HELIUS_API_KEY=

# Public RPC to use when HELIUS_API_KEY is unset. Defaults to https://api.mainnet-beta.solana.com
SOLANA_RPC_MAINNET=
```

The key is read only in the server route. A test (`test/no-client-key.test.ts`) fails if a client component imports the Helius client or names the key. No keypair, no writes. Grimoire only reads transactions.

---

## Record a new fixture

```bash
node scripts/record-fixture.mjs <signature> <cause>
```

`<cause>` is one of the causes in `src/lib/diagnose.ts`. The script refuses a transaction that did not fail and never writes the key to the file. The new fixture shows up as an example on the page and in the test suite.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Data | Helius RPC and Parsed Events, public Solana RPC fallback |
| Diagnosis | Plain TypeScript, no model |
| Tests | Vitest, offline |
| Styling | Tailwind CSS v4 |

---

## Project structure

```
src/
  app/
    api/diagnose/route.ts  # POST { signature } -> JSON diagnosis
    api/autopsy/route.ts   # POST { address } -> failed transactions grouped by cause
    page.tsx               # Doctor UI and failure census (server component)
  components/
    Doctor.tsx             # Input, example chips, result card, copy support reply
    CensusSection.tsx      # Census bars
    WalletAutopsy.tsx      # Address input and per-cause results
  lib/
    diagnose.ts            # Error to cause mapping
    helius.ts              # Helius client with public RPC fallback (server only)
    census.ts              # Counts causes over many transactions
    fixtures.ts            # Loads recorded fixtures
    support-reply.ts       # Template support answer
data/                      # Census source data
scripts/record-fixture.mjs # Records a failed transaction as a fixture
test/fixtures/tx/          # Recorded failed mainnet transactions
```

---

## MCP angle

`diagnose(meta)` is a pure function with no network and no model, so it can back an MCP tool such as `diagnose_transaction(signature)` that returns the same structured result an agent can reason over.

---

## Detected causes

- Slippage tolerance exceeded
- Not enough tokens in the source account
- Not enough SOL (fee, rent or transfer)
- Ran out of compute units
- Account not initialized
- Wrong account passed (owner or type)
- Missing required signature
- Instruction rejected (stale SDK or IDL, wrong program id)
- Anchor account constraint failed
- Program-specific error with its code, when the program's own error list is not known
