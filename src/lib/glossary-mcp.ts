/**
 * Oblivion Glossary MCP Integration
 *
 * Provides runtime Solana ecosystem terminology lookup for Claude's RAG context.
 *
 * Data source: vendored from gabchess/oblivion-glossary (forked from
 * solanabr/solana-glossary, MIT). 1059 terms across 14 categories with depth
 * ratings, aliases, and cross-references.
 *
 * The same upstream package also runs standalone as an MCP server via
 * `npx @stbr/solana-glossary`, so any Claude Code or external AI agent can
 * connect to the same terminology source. Oblivion vendors the JSON data
 * locally so the chat backend can call it synchronously without spawning an
 * MCP subprocess (which Vercel serverless functions cannot host).
 *
 * The fork at https://github.com/gabchess/oblivion-glossary preserves the
 * upstream MIT license and full MCP server implementation in `mcp/server.ts`,
 * `mcp/bin.ts`, and `mcp/tools.ts`.
 */

import type { GlossaryTerm } from "./glossary-types";

// Vendored data — 14 category files, ~1059 terms total
import aiMl from "./glossary-data/ai-ml.json";
import blockchainGeneral from "./glossary-data/blockchain-general.json";
import coreProtocol from "./glossary-data/core-protocol.json";
import defi from "./glossary-data/defi.json";
import devTools from "./glossary-data/dev-tools.json";
import infrastructure from "./glossary-data/infrastructure.json";
import network from "./glossary-data/network.json";
import programmingFundamentals from "./glossary-data/programming-fundamentals.json";
import programmingModel from "./glossary-data/programming-model.json";
import security from "./glossary-data/security.json";
import solanaEcosystem from "./glossary-data/solana-ecosystem.json";
import tokenEcosystem from "./glossary-data/token-ecosystem.json";
import web3 from "./glossary-data/web3.json";
import zkCompression from "./glossary-data/zk-compression.json";

export const allTerms: GlossaryTerm[] = [
  ...coreProtocol,
  ...programmingModel,
  ...tokenEcosystem,
  ...defi,
  ...zkCompression,
  ...infrastructure,
  ...security,
  ...devTools,
  ...network,
  ...blockchainGeneral,
  ...web3,
  ...programmingFundamentals,
  ...aiMl,
  ...solanaEcosystem,
] as GlossaryTerm[];

export interface GlossaryHit {
  id: string;
  term: string;
  category: string;
  definition: string;
  tags?: string[];
  url: string;
}

const GLOSSARY_BASE_URL = "https://github.com/gabchess/grimoire-glossary";

function termUrl(id: string): string {
  return `${GLOSSARY_BASE_URL}#${id}`;
}

/**
 * Find Solana glossary terms relevant to a user query. Two-pass:
 *   1. Direct substring matches on canonical term name OR aliases. High precision.
 *   2. Token-overlap heuristic: terms whose words overlap the query. Fallback.
 *
 * Returns at most maxResults hits, deduplicated by id.
 */
export function findRelevantGlossaryTerms(
  query: string,
  maxResults: number = 3
): GlossaryHit[] {
  const lowerQuery = query.toLowerCase();
  const queryTokens = lowerQuery
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  const seen = new Set<string>();
  const results: GlossaryHit[] = [];

  // Pass 1: substring match on canonical term name (strip parenthetical aliases)
  for (const t of allTerms) {
    const canonical = t.term.toLowerCase().split(" (")[0].trim();
    if (canonical.length < 3) continue;
    const aliases = (t.aliases || []).map((a) => a.toLowerCase());
    const matches =
      lowerQuery.includes(canonical) ||
      aliases.some((a) => a.length >= 3 && lowerQuery.includes(a));
    if (matches && !seen.has(t.id)) {
      seen.add(t.id);
      results.push({
        id: t.id,
        term: t.term,
        category: t.category,
        definition: t.definition,
        url: termUrl(t.id),
      });
      if (results.length >= maxResults) return results;
    }
  }

  // Pass 2: token overlap — score each remaining term by # of query tokens in its content
  if (results.length < maxResults) {
    const scored = allTerms
      .filter((t) => !seen.has(t.id))
      .map((t) => {
        const haystack = `${t.term} ${t.definition} ${(t.aliases || []).join(" ")}`.toLowerCase();
        const overlap = queryTokens.filter((tok) => haystack.includes(tok)).length;
        return { term: t, overlap };
      })
      .filter((x) => x.overlap >= 2)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, maxResults - results.length);

    for (const { term: t } of scored) {
      seen.add(t.id);
      results.push({
        id: t.id,
        term: t.term,
        category: t.category,
        definition: t.definition,
        url: termUrl(t.id),
      });
    }
  }

  return results;
}

/**
 * Render glossary hits as a context block for Claude. Caps each definition at
 * ~400 chars to keep prompt token footprint bounded.
 */
export function renderGlossaryContext(hits: GlossaryHit[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map(
    (h) =>
      `- **${h.term}** (${h.category}): ${h.definition.slice(0, 400)}${h.definition.length > 400 ? "..." : ""}`
  );
  return [
    "",
    "Solana Glossary Context:",
    ...lines,
  ].join("\n");
}
