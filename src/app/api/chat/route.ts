/**
 * POST /api/chat
 *
 * RAG endpoint: embed query → vector search Supabase → Claude streaming → attestation TX.
 *
 * Response: Server-Sent Events (SSE)
 *   data: {"type":"chunk","text":"..."}
 *   data: {"type":"done","citations":[...],"attestation":{"txSignature":"...","explorerUrl":"..."}}
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createAttestation } from "@/lib/attestation";
import { findRelevantGlossaryTerms, renderGlossaryContext } from "@/lib/glossary-mcp";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const CLIENT_ORG_ID =
  process.env.NEXT_PUBLIC_CLIENT_ORG_ID ||
  "00000000-0000-0000-0000-000000000001";

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
const TOP_K = 5;

interface KnowledgeChunk {
  id: string;
  content: string;
  source_path: string | null;
  page_type: string;
  page_slug: string;
  tags: string[] | null;
  similarity: number;
}

/** Cosine similarity between two Float32 arrays */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  // SSE helper
  function sseEvent(data: unknown): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const { query, daoSlug: _daoSlug } = body as {
          query: string;
          daoSlug?: string;
        };

        if (!query || typeof query !== "string" || query.trim().length === 0) {
          controller.enqueue(
            sseEvent({ type: "error", message: "query is required" })
          );
          controller.close();
          return;
        }

        const trimmedQuery = query.trim();

        // --- Step 1: Embed the query ---
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        const embedResponse = await openai.embeddings.create({
          model: EMBED_MODEL,
          input: trimmedQuery,
          dimensions: EMBED_DIM,
        });
        const queryEmbedding = embedResponse.data[0].embedding;

        // --- Step 2: Vector search via Supabase ---
        // Strategy: SUPABASE_RPC with pgvector <=> operator.
        // We try a raw SQL RPC first. If that fails we fall back to JS cosine.
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        let topChunks: KnowledgeChunk[] = [];

        try {
          // Attempt direct pgvector query via RPC match_chunks function
          // This function may or may not exist; handle gracefully
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            "match_knowledge_chunks",
            {
              query_embedding: queryEmbedding,
              match_client_org_id: CLIENT_ORG_ID,
              match_count: TOP_K,
            }
          );

          if (rpcError) throw rpcError;

          topChunks = (rpcData as KnowledgeChunk[]) || [];
        } catch {
          // Fallback: fetch embeddings for this org, compute cosine in JS
          // 1150 rows × 1536 floats ≈ 7MB — acceptable for MVP
          // Supabase free-tier PostgREST caps response at 1000 rows. With 1150
          // total chunks (1059 glossary + 91 governance), a single .select on
          // knowledge_graph silently truncates governance rows. Fix: fetch by
          // page_type separately so each query stays under the cap, then merge.
          // .range() forces explicit row windows that bypass the default cap.
          const [govKg, glossKg] = await Promise.all([
            supabase
              .from("knowledge_graph")
              .select("id, content, source_path, page_type, page_slug, tags")
              .eq("client_org_id", CLIENT_ORG_ID)
              .eq("page_type", "governance_proposal")
              .range(0, 999),
            supabase
              .from("knowledge_graph")
              .select("id, content, source_path, page_type, page_slug, tags")
              .eq("client_org_id", CLIENT_ORG_ID)
              .eq("page_type", "glossary_baseline")
              .range(0, 999),
          ]);

          if (govKg.error) throw new Error(`Governance fetch failed: ${govKg.error.message}`);
          if (glossKg.error) throw new Error(`Glossary fetch failed: ${glossKg.error.message}`);

          const kgRows = [...(govKg.data || []), ...(glossKg.data || [])];

          // Fetch embeddings in TWO passes to defeat Supabase's hard 1000-row
          // cap (the Range header is ignored on PostgREST; .range(0, 1999) still
          // returns max 1000). Because glossary was ingested before governance,
          // a single default-ordered fetch returns all 1000 first-row glossary
          // embeddings and zero governance — the governance embeddings live at
          // sort positions ~1059-1150. Fix: fetch governance embeddings
          // explicitly via .in("source_id", govIds) with the 91 governance UUIDs
          // (~3.4KB URL, well under PostgREST's limit), then fetch glossary
          // embeddings via .range. Dedupe by id when combining.
          const govIds = (govKg.data || []).map((r) => r.id as string);

          const [govEmbedRes, glossEmbedRes] = await Promise.all([
            govIds.length > 0
              ? supabase
                  .from("memory_embeddings")
                  .select("id, source_id, embedding")
                  .eq("client_org_id", CLIENT_ORG_ID)
                  .eq("source_table", "knowledge_graph")
                  .in("source_id", govIds)
              : Promise.resolve({ data: [], error: null }),
            supabase
              .from("memory_embeddings")
              .select("id, source_id, embedding")
              .eq("client_org_id", CLIENT_ORG_ID)
              .eq("source_table", "knowledge_graph")
              .range(0, 999),
          ]);

          if (govEmbedRes.error) throw new Error(`Gov embedding fetch failed: ${govEmbedRes.error.message}`);
          if (glossEmbedRes.error) throw new Error(`Gloss embedding fetch failed: ${glossEmbedRes.error.message}`);

          const seenEmbedIds = new Set<string>();
          const embedRows = [...(govEmbedRes.data || []), ...(glossEmbedRes.data || [])].filter((row) => {
            const id = row.id as string;
            if (seenEmbedIds.has(id)) return false;
            seenEmbedIds.add(id);
            return true;
          });

          // Build a map for fast lookup
          const kgMap = new Map(
            kgRows.map((row) => [row.id as string, row])
          );

          // Score each embedding
          const scoredAll = (embedRows || [])
            .map((eRow) => {
              const kg = kgMap.get(eRow.source_id as string);
              if (!kg) return null;
              // Supabase returns vector as string "[0.1,0.2,...]"; parse it
              let embVec: number[] = [];
              if (typeof eRow.embedding === "string") {
                embVec = JSON.parse(eRow.embedding.replace(/[{}]/g, ""));
              } else if (Array.isArray(eRow.embedding)) {
                embVec = eRow.embedding as number[];
              }
              const sim = cosineSimilarity(queryEmbedding, embVec);
              return { ...kg, similarity: sim } as KnowledgeChunk;
            })
            .filter((x): x is KnowledgeChunk => x !== null)
            .sort((a, b) => b.similarity - a.similarity);

          // Two-pass bias: governance_proposal chunks lead, glossary fills the rest.
          // Rationale: short glossary entries embed tightly and outrank longer
          // governance proposal chunks under raw cosine similarity, even when the
          // user query is a governance question. For DAO Q&A the governance source
          // is the load-bearing citation; glossary is supporting context.
          const GOV_QUOTA = 3;
          const GLOSS_QUOTA = TOP_K - GOV_QUOTA;
          const governance = scoredAll
            .filter((c) => c.page_type === "governance_proposal")
            .slice(0, GOV_QUOTA);
          const glossary = scoredAll
            .filter((c) => c.page_type === "glossary_baseline")
            .slice(0, GLOSS_QUOTA);
          // If governance is thin, top off with more glossary; if glossary is thin
          // (no matches), keep the governance slots.
          const combined = [...governance, ...glossary];
          if (combined.length < TOP_K) {
            const usedIds = new Set(combined.map((c) => c.id));
            const filler = scoredAll
              .filter((c) => !usedIds.has(c.id))
              .slice(0, TOP_K - combined.length);
            combined.push(...filler);
          }

          topChunks = combined;
        }

        if (topChunks.length === 0) {
          controller.enqueue(
            sseEvent({
              type: "error",
              message: "No relevant context found for this query.",
            })
          );
          controller.close();
          return;
        }

        // --- Step 3: Glossary MCP enrichment ---
        // Look up Solana-specific terminology from the gabchess/oblivion-glossary
        // MCP server (forked from solanabr/solana-glossary, 1059 terms across 14
        // categories). The same package runs standalone as `npx solana-glossary`
        // for any Claude Code agent; here we call its SDK at runtime to enrich
        // Claude's grounding with precise term definitions alongside RAG chunks.
        const glossaryHits = findRelevantGlossaryTerms(trimmedQuery, 3);
        const glossaryContextBlock = renderGlossaryContext(glossaryHits);

        // --- Step 4: Compose Claude prompt ---
        const contextText = topChunks
          .map(
            (chunk, i) =>
              `[Source ${i + 1}] (${chunk.page_type}) ${chunk.page_slug}\nURL: ${chunk.source_path || "N/A"}\n\n${chunk.content}`
          )
          .join("\n\n---\n\n");

        const systemPrompt = `You are Oblivion, an AI assistant for DAO governance questions.
You answer questions using only the provided source documents from the DAO's governance forum.
You may also draw on the Solana Glossary Context block (sourced from the gabchess/oblivion-glossary MCP server) when terminology disambiguation helps.
Always cite sources by referencing [Source N] in your answer. Glossary terms are background context, not citable sources.
Be concise, accurate, and grounded in the evidence. Do not speculate beyond what the sources say.`;

        const userMessage = `Context from Marinade DAO governance forum:\n\n${contextText}${glossaryContextBlock}\n\n---\n\nQuestion: ${trimmedQuery}`;

        // --- Step 4: Stream Claude response ---
        const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

        let fullResponse = "";

        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(sseEvent({ type: "chunk", text }));
          }
        }

        // --- Step 5: Build citations from top chunks ---
        const citations = topChunks
          .filter((chunk) => chunk.source_path)
          .map((chunk) => ({
            proposalId: chunk.page_slug,
            title: chunk.page_slug
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            sourceUrl: chunk.source_path!,
          }));

        // --- Step 6: Create attestation TX ---
        let attestation: {
          txSignature: string;
          pda: string;
          explorerUrl: string;
        } | null = null;

        try {
          const topChunk = topChunks[0];
          attestation = await createAttestation({
            clientOrgId: CLIENT_ORG_ID,
            sourceDocContent: topChunk.content,
            query: trimmedQuery,
            response: fullResponse,
            sourceUrl: topChunk.source_path || topChunk.page_slug,
          });
        } catch (attErr) {
          console.error("Attestation TX failed (non-blocking):", attErr);
          // Return a placeholder so the UI still renders
          attestation = {
            txSignature: "ATTESTATION_FAILED",
            pda: "",
            explorerUrl: "",
          };
        }

        // --- Step 7: Send done event ---
        controller.enqueue(
          sseEvent({
            type: "done",
            citations,
            attestation,
          })
        );

        controller.close();
      } catch (err) {
        console.error("/api/chat error:", err);
        controller.enqueue(
          sseEvent({
            type: "error",
            message:
              err instanceof Error ? err.message : "Internal server error",
          })
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
