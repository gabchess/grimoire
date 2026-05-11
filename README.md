# Oblivion

The AI knowledge brain for Solana companies. Drop in your governance forum, repos, and docs. Oblivion builds a Postgres pgvector index, answers questions via Claude with grounded citations, and writes every important decision to Solana as a permanent onchain attestation.

Inspired by [Karpathy's Wiki LLM](https://x.com/karpathy/status/1769428080543207556) and Garry Tan's gbrain pattern. Built for [Colosseum Frontier 2026](https://www.colosseum.com/frontier).

## What it does

Marinade DAO has 30 governance proposals across three forum migrations, indexed as 91 retrieval chunks, and a community that asks the same questions every week. Most members never read past MIP-5.

Oblivion ingests their full governance history, embeds it in Postgres pgvector, and serves a chat interface that answers questions like "what does MIP-19 say about validator stake auction strategy?" with:

1. **Grounded citations** linking to the exact forum proposal chunks the answer relies on
2. **Solana terminology context** from a 1059-term glossary served via an MCP server fork ([gabchess/oblivion-glossary](https://github.com/gabchess/oblivion-glossary))
3. **An onchain attestation TX** on Solana devnet (mainnet-ready) recording the query, the source documents, the response, and a deterministic PDA: provable provenance for every claim the AI makes

The killer feature is the attestation. Every AI answer becomes a permanent onchain record. If the AI hallucinates, the attestation lets anyone prove which source documents the answer was grounded in and reconstruct the exact retrieval that produced it.

## Demo flow

1. Ask: "What does MIP-19 say about validator stake auction strategy?"
2. Oblivion retrieves the top 3 MIP-19 chunks from the Marinade governance forum + 2 supporting glossary terms
3. Claude streams an answer with inline `[Source N]` citations
4. An attestation TX lands on Solana devnet: signature + PDA + explorer URL appear in the UI
5. Click the attestation pill and solana.fm shows the live onchain account with hashed inputs

Sample attestation: [3gdvdXLfmZ1wgDBZD4VKCjvk7KrHVgCdQAj2uDqJen8kBnJWRntDA967Wr5FvCouXJ7xA6kaZnUPFM7DKAhDVXia](https://solana.fm/tx/3gdvdXLfmZ1wgDBZD4VKCjvk7KrHVgCdQAj2uDqJen8kBnJWRntDA967Wr5FvCouXJ7xA6kaZnUPFM7DKAhDVXia?cluster=devnet-alpha)

## Architecture

```
User query
  ├── OpenAI text-embedding-3-small → 1536-dim vector
  ├── pgvector cosine search → top-K knowledge chunks
  │     (3 governance_proposal bias + 2 glossary_baseline bias)
  ├── Glossary MCP server SDK lookup → 3 relevant Solana terms
  ├── Claude Sonnet 4.6 streaming with grounded context
  └── Anchor program PDA derivation + createAttestation TX
        → permanent onchain record of (org, source_hash, query_hash, response_hash)
```

## Stack

- **Frontend**: Next.js 16 App Router, TypeScript, Tailwind CSS, React 19
- **Database**: Supabase Postgres with pgvector extension, RLS per `client_org_id` for multi-tenant isolation
- **AI**: OpenAI embeddings + Anthropic Claude Sonnet 4.6 (streaming SSE)
- **Onchain**: Anchor program on Solana devnet, deployable to mainnet without source changes
- **Glossary MCP**: forked [@stbr/solana-glossary](https://github.com/solanabr/solana-glossary) (MIT), 1059 terms across 14 categories with standalone MCP server (`npx solana-glossary`) any Claude Code user can connect to
- **Ingest pipeline**: separate TypeScript service that pulls Discourse forum threads, chunks at ~800 tokens, embeds via OpenAI, upserts into knowledge_graph + memory_embeddings tables

## Repository layout

This repo contains the frontend + RAG backend + Anchor TS client. Sibling repos handle ingest + the deployed Anchor program:

- `oblivion/`: this repo. Next.js frontend, RAG API route, Anchor client, vendored glossary
- [`oblivion-glossary/`](https://github.com/gabchess/oblivion-glossary): the forked MCP server + 1059 Solana terms
- Ingest pipeline + Anchor program source live in private repos pre-Colosseum; will open-source post-submission

## Anchor program

- **Program ID** (devnet): `B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm`
- **Account struct**: `GrimoireAttestation` (legacy codename preserved in deployed bytecode; user-facing brand is Oblivion)
- **PDA seeds**: `[b"grimoire-att", client_org_id, source_doc_hash, query_hash]`
- **Instructions**: `createAttestation(client_org_id, source_doc_hash, query_hash, response_hash, source_url_short)`

The seed bytes `b"grimoire-att"` are immutable in the deployed program. Renaming the seed would change PDA derivation and invalidate every existing attestation, so the source preserves the original codename.

## Run locally

```bash
# Frontend
cd oblivion
cp .env.local.example .env.local  # fill in keys
npm install
npm run dev
# open http://localhost:3000

# The dev server reads ANTHROPIC_API_KEY from .env.local. If your shell exports
# an empty ANTHROPIC_API_KEY (some setups do), bypass shell shadowing with:
env ANTHROPIC_API_KEY=$(cat /path/to/anthropic-key) npm run dev
```

Required env vars (`.env.local`):

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SOLANA_RPC_URL` (devnet default OK)
- `NEXT_PUBLIC_PROGRAM_ID` (defaults to deployed devnet program)
- `NEXT_PUBLIC_CLIENT_ORG_ID` (UUID for tenant scope; Marinade demo = `00000000-0000-0000-0000-000000000001`)
- `NEXT_PUBLIC_SOLANA_CLUSTER` (`devnet-alpha` for solana.fm explorer URLs)

For production (Vercel):

- `SOLANA_KEYPAIR_JSON`: the JSON array `solana-keygen` produces (65-byte array). Vercel has no filesystem access, so the keypair has to round-trip through an env var.

## Acknowledgments

- [Andrej Karpathy](https://x.com/karpathy) for the Wiki LLM framing
- [Garry Tan](https://x.com/garrytan) for the gbrain pattern
- [solanabr](https://github.com/solanabr/solana-glossary) for the open glossary MCP server we forked
- [Marinade Finance](https://forum.marinade.finance) for the governance forum corpus the demo runs against

## License

MIT. See [LICENSE](./LICENSE).

Built for [Colosseum Frontier 2026](https://www.colosseum.com/frontier) by [gabchess](https://x.com/gabe_onchain). Submitted 2026-05-11 for the AI Platforms / Agents category.
