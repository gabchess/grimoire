/**
 * POST /api/chat
 *
 * Grimoire chat endpoint: query -> glossary grounding -> Claude streaming -> attestation TX.
 *
 * Response: Server-Sent Events (SSE)
 *   data: {"type":"chunk","text":"..."}
 *   data: {"type":"done","glossaryTerms":[...],"attestation":{...}}
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAttestation } from "@/lib/attestation";
import {
  findRelevantGlossaryTerms,
  renderGlossaryContext,
  type GlossaryHit,
} from "@/lib/glossary-mcp";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  function sseEvent(data: unknown): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await req.json();
        const { query, context } = body as {
          query: string;
          context?: string;
        };

        if (!query || typeof query !== "string" || query.trim().length === 0) {
          controller.enqueue(
            sseEvent({ type: "error", message: "query is required" })
          );
          controller.close();
          return;
        }

        const trimmedQuery = query.trim();

        // --- Step 1: Glossary grounding ---
        const hits: GlossaryHit[] = findRelevantGlossaryTerms(trimmedQuery, 5);
        const glossaryContext = renderGlossaryContext(hits);

        // --- Step 2: Compose prompt ---
        const extraContext = context ? `\nAdditional context provided by user:\n${context}` : "";

        const systemPrompt =
          "You are Grimoire, a Solana assistant. Answer questions grounded in the provided Solana glossary context. Be concise and accurate. Do not speculate beyond what the glossary and your knowledge confirm.";

        const userMessage =
          `${glossaryContext}${extraContext}\n\n---\n\nQuestion: ${trimmedQuery}`;

        // --- Step 3: Stream Claude response ---
        const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

        let fullAnswer = "";

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
            fullAnswer += text;
            controller.enqueue(sseEvent({ type: "chunk", text }));
          }
        }

        // --- Step 4: Attestation TX ---
        let attestation: {
          txSignature: string;
          pda: string;
          explorerUrl: string;
        } | null = null;

        try {
          attestation = await createAttestation({
            clientOrgId: "00000000-0000-0000-0000-000000000001",
            sourceDocContent: glossaryContext || context || query,
            query: trimmedQuery,
            response: fullAnswer,
            sourceUrl: "grimoire-glossary",
          });
        } catch (attErr) {
          console.error("Attestation TX failed (non-blocking):", attErr);
          attestation = {
            txSignature: "ATTESTATION_FAILED",
            pda: "",
            explorerUrl: "",
          };
        }

        // --- Step 5: Done event ---
        controller.enqueue(
          sseEvent({
            type: "done",
            glossaryTerms: hits.map((h) => ({
              term: h.term,
              category: h.category,
            })),
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
