# Grimoire: Solana Transaction Doctor

Paste a failed Solana transaction signature. Grimoire fetches it via RPC, decodes the failure against known Anchor and runtime error patterns, and returns a plain-English root cause with a concrete fix.

Real example: `Error Code: ConstraintSeeds. Error Number: 2006.` becomes "Your PDA seeds on the client don't match what the program derives with `find_program_address`. Check that the seed buffers and program ID are identical on both sides."

---

## How it works

Two-stage pipeline:

1. **Deterministic decode** (`src/lib/tx-decode.ts`): no LLM. Pattern-matches against `meta.err`, `meta.logMessages`, and compute unit data. This is what makes the output reliable rather than a hallucination machine.

2. **Claude explains**: the structured decode result is passed to `claude-sonnet-4-6` via `@anthropic-ai/sdk`. The system prompt is explicit: explain what the decoder found, give a concrete fix. Claude does not re-detect errors. Grounded with relevant terms from a local Solana glossary (1000+ terms, 14 categories).

The split matters. If the decode returns no patterns, Claude says so. It does not invent errors.

---

## Quickstart

```bash
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY (required)
# SOLANA_RPC_* default to public endpoints; set for higher rate limits

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Paste any mainnet or devnet transaction signature.

---

## Environment variables

```
ANTHROPIC_API_KEY=sk-ant-...

# Optional: defaults to public RPC if unset
SOLANA_RPC_MAINNET=https://api.mainnet-beta.solana.com
SOLANA_RPC_DEVNET=https://api.devnet.solana.com
```

No keypair. No program ID. Grimoire reads transactions, it does not write them.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| AI | Claude `claude-sonnet-4-6` via `@anthropic-ai/sdk` (streaming) |
| Solana | `@solana/web3.js`, RPC reads only |
| Glossary | Local Solana glossary, 1000+ terms, 14 categories |
| Styling | Tailwind CSS v4 |

---

## Project structure

```
src/
  app/
    api/diagnose/route.ts  # SSE: fetch tx -> decode -> Claude explanation
    page.tsx               # Single-page Tx Doctor UI
    layout.tsx             # Metadata
  components/
    Logo.tsx               # Grimoire logomark
  lib/
    tx-decode.ts           # Deterministic decode engine (no LLM)
    glossary-mcp.ts        # Local glossary lookup
    glossary-data/         # 14 JSON term files
```

---

## MCP angle

The decode engine (`tx-decode.ts`) is designed to be callable as an MCP tool. An LLM agent running in a Solana dev context could call `diagnose_transaction(sig)` and get the structured decode result back as tool output, then reason over it. The same separation that makes the web UI reliable makes it a good MCP primitive.

---

## Detected patterns

- Anchor framework errors (codes 2000 to 3999) with name, number, message, and causing account
- Program-specific custom errors (codes 6000+) with IDL lookup guidance
- Compute budget exceeded / near-limit usage
- Insufficient lamports and rent failures
- Account already in use (PDA collision / re-init)
- Blockhash not found (stale transaction)
- Failing program ID extraction from logs
