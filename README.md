# Grimoire

Verifiable onchain AI on Solana.

Ask a Solana question. Get a grounded answer. Every response is permanently anchored onchain as a Solana attestation.

---

## What it does

Grimoire is a single-purpose tool with one primitive:

1. A user asks a Solana question.
2. Claude answers, grounded by a local Solana glossary of 1000+ terms.
3. The query, answer, and source hashes are anchored onchain as a permanent Solana PDA via a custom Anchor program.
4. A solana.fm link is shown in the UI so the attestation is verifiable by anyone.

That is the whole product. No multi-tenancy. No RAG database. No company brain features.

---

## How the onchain attestation works

Each attestation is a PDA derived from:

```
seeds = ["grimoire-att", client_org_id_bytes, sha256(source), sha256(query)]
```

The `create_attestation` instruction stores hashes of the query, response, and source document on devnet. The program was deployed and is live. Its ID is immutable.

**Program ID:** `B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm`

The on-chain program name is `grimoire_attestation`. The seed prefix `"grimoire-att"` is part of the deployed bytecode and cannot be changed without redeployment.

---

## Quickstart

### Prerequisites

- Node.js 18+
- A Solana keypair (for signing attestation transactions)
- An Anthropic API key

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
ANTHROPIC_API_KEY=sk-ant-...

# JSON array form of your Solana keypair (Vercel-compatible)
# Generate: solana-keygen new --outfile /tmp/grimoire-key.json && cat /tmp/grimoire-key.json
SOLANA_KEYPAIR_JSON=[204,100,21,...]

NEXT_PUBLIC_PROGRAM_ID=B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet-alpha
```

For local development, if `SOLANA_KEYPAIR_JSON` is not set, the server falls back to `~/.config/solana/id.json`.

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| AI | Claude via `@anthropic-ai/sdk` (streaming) |
| Onchain | Anchor + `@coral-xyz/anchor`, `@solana/web3.js` |
| Glossary | Local Solana glossary, 1000+ terms across 14 categories |
| Styling | Tailwind CSS v4 |

---

## Project structure

```
src/
  app/
    api/chat/route.ts   # SSE endpoint: glossary -> Claude -> attestation
    page.tsx            # Single-page UI
    layout.tsx          # Metadata
  components/
    AttestationPill.tsx # Live solana.fm link component
    Logo.tsx            # Grimoire logomark
    ...
  lib/
    attestation.ts      # Anchor client -- do not modify PROGRAM_ID or SEED_PREFIX
    glossary-mcp.ts     # Local glossary lookup
    glossary-data/      # 14 JSON term files
    idl/
      grimoire_attestation.json
```

---

## Notes

- The attestation client is server-side only. Do not import it from client components.
- The keypair signs every attestation transaction and needs devnet SOL. Airdrop: `solana airdrop 2 <pubkey> --url devnet`.
- Attestation failures are non-blocking. If the TX fails, the answer is still returned with a failure indicator.
