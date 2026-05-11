# Oblivion

**The AI brain for Solana companies. Drop your governance, repos, X posts, and docs. Every important answer deploys onchain as a permanent attestation.**

Andrej Karpathy framed the LLM Wiki pattern in [April 2026](https://x.com/karpathy/status/2039805659525644595). Garry Tan shipped the personal-scale version with [gbrain](https://github.com/garrytan/gbrain) twelve days later. Oblivion productizes the org-scale version for Solana companies, with the onchain attestation layer that makes the provenance unfalsifiable.

Built for [Colosseum Frontier 2026](https://www.colosseum.com/frontier).

## What it does

Every active Solana company drowns in its own history. Operators grep Discourse, Notion, Telegram, GitHub, and X to brief the founder every morning. New contributors take six weeks to reach decision-context parity. The same proposals get re-litigated quarterly because nobody remembers what was already decided.

Oblivion is the per-tenant AI brain underneath all of it.

You drop your sources: governance forum, GitHub repos and issues, X timelines, Discord, Notion, treasury TXs, Realms votes. An AI agent builds the index. You and your contributors ask questions in plain English. Every answer comes back with grounded citations to the exact source chunks. Every decision that matters becomes a permanent Solana attestation: query hash, source-document hashes, response hash, deterministic PDA. Notion gets edited. The attestation does not.

The pattern is non-random. Three signals converged:

1. **Every active Solana DAO drowns in proposals.** Marinade alone has 30 proposals across three forum migrations indexed as 91 retrieval chunks. Jito, Drift, Kamino, MarginFi hit the same wall at the same time. Universal pain in 2026, not Marinade-specific.

2. **AI agents finally cross the institutional-scale threshold.** Karpathy and Garry Tan proved the pattern at personal scale. ChatGPT answers "what is validator delegation?" The org-scale per-tenant version, the one that answers "what is OUR DAO's position on validator delegation," was the next obvious build.

3. **Solana attestations are cheap enough to use universally.** Pennies per record. [Glean](https://www.glean.com/) ($7.2B valuation) cannot retrofit this without rebuilding their Postgres + S3 stack and growing a wallet management story they do not have. The architectural moat is real.

DAOs are the lead vertical. The pattern works for any Solana company with multi-source decision history: protocols, foundations, validator collectives, post-seed startups with a public roadmap.

## Demo flow

Marinade DAO's public governance forum is the live demo tenant. The full Marinade corpus is ingested: 30 proposals across three forum migrations, indexed as 91 retrieval chunks, plus 1059 Solana glossary terms for baseline context.

1. Ask: "What does MIP-19 say about validator stake auction strategy?"
2. Oblivion retrieves the top 3 MIP-19 chunks from the Marinade governance forum plus 2 supporting glossary terms.
3. Claude Sonnet 4.6 streams a grounded answer with inline `[Source N]` citations.
4. An attestation TX lands on Solana devnet. Signature, PDA, and explorer URL appear in the UI.
5. Click the attestation pill. solana.fm shows the live onchain account with hashed inputs.

Sample attestation: [3gdvdXLfmZ1wgDBZD4VKCjvk7KrHVgCdQAj2uDqJen8kBnJWRntDA967Wr5FvCouXJ7xA6kaZnUPFM7DKAhDVXia](https://solana.fm/tx/3gdvdXLfmZ1wgDBZD4VKCjvk7KrHVgCdQAj2uDqJen8kBnJWRntDA967Wr5FvCouXJ7xA6kaZnUPFM7DKAhDVXia?cluster=devnet-alpha)

If a contributor or a partner contests the answer twelve months later, the attestation lets anyone reconstruct the exact retrieval that produced it.

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

The two-pass cosine bias defeats the default-order cap PostgREST puts on large result sets. RLS isolation on `client_org_id` keeps tenant brains separate at the database layer, same multi-tenant pattern enterprises already trust.

## Stack

- **Frontend:** Next.js 16 App Router, TypeScript, Tailwind CSS, React 19.
- **Database:** Supabase Postgres with the pgvector extension, RLS per `client_org_id` for multi-tenant isolation.
- **AI:** OpenAI text-embedding-3-small for query vectors (1536 dim), Anthropic Claude Sonnet 4.6 for grounded streaming with inline citations.
- **Onchain:** Anchor 1.0.2 program on Solana devnet. Mainnet path is bytecode-identical (one redeploy, no source changes).
- **Glossary MCP:** forked [@stbr/solana-glossary](https://github.com/solanabr/solana-glossary) (MIT). 1059 terms across 14 categories. Ships standalone as `npx solana-glossary`, connectable from any Claude Code, Cursor, or MCP-compatible client.
- **Ingest pipeline:** separate TypeScript service that pulls Discourse threads, chunks at ~800 tokens, embeds via OpenAI, upserts into `knowledge_graph` and `memory_embeddings` tables.

## Repository layout

The submission ships across three repos. This one carries the frontend, RAG, and Anchor client. The glossary fork is already open. The ingest pipeline and Anchor program source go MIT post-Frontier.

- `oblivion/`: this repo. Next.js frontend, RAG API route, Anchor client, vendored glossary.
- [`oblivion-glossary/`](https://github.com/gabchess/oblivion-glossary): the forked MCP server plus 1059 Solana terms. Already open (MIT).
- Ingest pipeline + Anchor program source live in private repos pre-Frontier. Both ship MIT after submission.

## Anchor program

- **Program ID** (devnet): `B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm`
- **Account struct:** `GrimoireAttestation`. Codename preservation: the deployed bytecode uses the original project name. User-facing brand is Oblivion.
- **PDA seeds:** `[b"grimoire-att", client_org_id, source_doc_hash, query_hash]`
- **Instructions:** `createAttestation(client_org_id, source_doc_hash, query_hash, response_hash, source_url_short)`

The seed bytes `b"grimoire-att"` are immutable in the deployed program. Renaming the seed would change PDA derivation and invalidate every existing attestation, so the source preserves the original codename. Mainnet redeploy is bytecode-identical: same source, same seeds, same PDA derivation, new cluster.

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

For production on Vercel:

- `SOLANA_KEYPAIR_JSON`: the JSON array `solana-keygen` produces (65-byte array). Vercel has no filesystem access, so the keypair round-trips through an env var.

## Acknowledgments

The lineage matters. Hat-tips in chronological order.

- [Andrej Karpathy](https://x.com/karpathy) for the [LLM Wiki framing](https://x.com/karpathy/status/2039805659525644595) (April 3 2026) and the [follow-up idea file gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).
- [Garry Tan](https://x.com/garrytan) for [gbrain](https://github.com/garrytan/gbrain), the [open-source release tweet](https://x.com/garrytan/status/2042306761731031208), and the [cognitive-armor framing](https://x.com/garrytan/status/2043075944743923845) ("cognitive armor above the API line").
- [solanabr](https://github.com/solanabr/solana-glossary) for the open Solana glossary MCP server we forked.
- [Marinade Finance](https://forum.marinade.finance) for the public governance forum that powers the live demo. No partnership implied; the demo runs on publicly accessible data.

## License

MIT. See [LICENSE](./LICENSE).

Built for [Colosseum Frontier 2026](https://www.colosseum.com/frontier) by [gabchess](https://x.com/gabe_onchain). Submitted 2026-05-11 for the AI Platforms / Agents category.
