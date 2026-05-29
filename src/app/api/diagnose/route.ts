/**
 * POST /api/diagnose
 *
 * Grimoire Tx Doctor endpoint.
 *
 * Input:  { signature: string, cluster?: "mainnet" | "devnet" }
 * Output: Server-Sent Events (SSE)
 *   data: {"type":"chunk","text":"..."}
 *   data: {"type":"done","decode":{...},"explorerUrl":"..."}
 *   data: {"type":"error","message":"..."}
 *
 * Design: deterministic decode FIRST, then Claude explains what was found.
 * Claude does not detect errors — it explains the structured decode result.
 */

import { NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";
import Anthropic from "@anthropic-ai/sdk";
import { decodeTransactionFailure, type DecodeResult } from "@/lib/tx-decode";
import {
  findRelevantGlossaryTerms,
  renderGlossaryContext,
} from "@/lib/glossary-mcp";

// ─── RPC endpoints (server-side only, not NEXT_PUBLIC_) ──────────────────────
const RPC_MAINNET =
  process.env.SOLANA_RPC_MAINNET ?? "https://api.mainnet-beta.solana.com";
const RPC_DEVNET =
  process.env.SOLANA_RPC_DEVNET ?? "https://api.devnet.solana.com";

type Cluster = "mainnet" | "devnet";

function rpcUrl(cluster: Cluster): string {
  return cluster === "devnet" ? RPC_DEVNET : RPC_MAINNET;
}

function explorerUrl(sig: string, cluster: Cluster): string {
  const clusterParam = cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://solana.fm/tx/${sig}${clusterParam}`;
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function sseEvent(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Build Claude prompt from decode result ───────────────────────────────────

function buildUserMessage(
  sig: string,
  cluster: Cluster,
  decode: DecodeResult,
  glossaryCtx: string
): string {
  const lines: string[] = [];

  lines.push(`Transaction: ${sig}`);
  lines.push(`Cluster: ${cluster}`);
  lines.push(`Status: ${decode.failed ? "FAILED" : "SUCCESS"}`);
  lines.push(`Fee: ${decode.fee} lamports`);
  if (decode.computeUnitsConsumed !== null) {
    lines.push(`Compute units consumed: ${decode.computeUnitsConsumed.toLocaleString()}`);
  }

  if (decode.failed) {
    lines.push("");
    lines.push("=== DETERMINISTIC DECODE RESULT ===");

    if (decode.rawError) {
      lines.push(`Raw error: ${decode.rawError}`);
    }

    if (decode.failingProgram) {
      lines.push(`Failing program: ${decode.failingProgram}`);
    }

    if (decode.anchorError) {
      lines.push("");
      lines.push("Anchor error detected:");
      lines.push(`  Code: ${decode.anchorError.code}`);
      lines.push(`  Number: ${decode.anchorError.number}`);
      lines.push(`  Message: ${decode.anchorError.message}`);
      if (decode.anchorError.causingAccount) {
        lines.push(`  Causing account: ${decode.anchorError.causingAccount}`);
      }
    }

    if (decode.customErrorCode !== undefined) {
      lines.push(`Custom error code: ${decode.customErrorCode} (0x${decode.customErrorCode.toString(16).toUpperCase()})`);
    }

    if (decode.detectedPatterns.length > 0) {
      lines.push("");
      lines.push("Detected patterns:");
      for (const p of decode.detectedPatterns) {
        lines.push(`  Pattern: ${p.pattern}`);
        lines.push(`  Explanation: ${p.explanation}`);
        lines.push(`  Suggested fix: ${p.suggestedFix}`);
      }
    }
  } else {
    lines.push("");
    lines.push("This transaction succeeded. No error to decode.");
  }

  if (glossaryCtx) {
    lines.push("");
    lines.push(glossaryCtx);
  }

  return lines.join("\n");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // --- Parse and validate input ---
        const body = await req.json().catch(() => ({}));
        const { signature, cluster: rawCluster } = body as {
          signature?: unknown;
          cluster?: unknown;
        };

        if (typeof signature !== "string" || signature.trim().length === 0) {
          controller.enqueue(
            sseEvent({ type: "error", message: "signature is required" })
          );
          controller.close();
          return;
        }

        const sig = signature.trim();
        const cluster: Cluster =
          rawCluster === "devnet" ? "devnet" : "mainnet";

        // --- Fetch transaction ---
        const connection = new Connection(rpcUrl(cluster), "confirmed");

        let txResult;
        try {
          txResult = await connection.getTransaction(sig, {
            maxSupportedTransactionVersion: 0,
          });
        } catch (rpcErr) {
          controller.enqueue(
            sseEvent({
              type: "error",
              message: `RPC error: ${rpcErr instanceof Error ? rpcErr.message : String(rpcErr)}`,
            })
          );
          controller.close();
          return;
        }

        if (txResult === null) {
          controller.enqueue(
            sseEvent({
              type: "error",
              message: `Transaction not found on ${cluster}. It may not be confirmed yet, or the signature may be invalid.`,
            })
          );
          controller.close();
          return;
        }

        const { meta, transaction } = txResult;

        if (!meta) {
          controller.enqueue(
            sseEvent({
              type: "error",
              message: "Transaction metadata unavailable — the node may not have processed it yet.",
            })
          );
          controller.close();
          return;
        }

        // --- Deterministic decode ---
        const decode = decodeTransactionFailure(meta, { transaction } as never);

        // --- Glossary grounding ---
        // Build a query string from error patterns for term lookup
        const glossaryQuery = [
          decode.anchorError?.code ?? "",
          decode.anchorError?.message ?? "",
          ...decode.detectedPatterns.map((p) => p.pattern),
          decode.rawError ?? "",
        ]
          .filter(Boolean)
          .join(" ");

        const glossaryHits = findRelevantGlossaryTerms(
          glossaryQuery || "Solana transaction error program",
          4
        );
        const glossaryCtx = renderGlossaryContext(glossaryHits);

        // --- Stream Claude explanation ---
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY!,
        });

        const systemPrompt = `You are Grimoire, a Solana transaction debugger. Given the DECODED failure data (already extracted deterministically), explain the root cause in plain English and give a concrete fix. Be specific and concise. Do not invent errors not present in the decoded data. Do not re-derive what the decoder already found — explain it clearly for a developer who needs to fix their code.`;

        const userMessage = buildUserMessage(sig, cluster, decode, glossaryCtx);

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
            controller.enqueue(sseEvent({ type: "chunk", text: event.delta.text }));
          }
        }

        // --- Done event ---
        controller.enqueue(
          sseEvent({
            type: "done",
            decode,
            explorerUrl: explorerUrl(sig, cluster),
          })
        );

        controller.close();
      } catch (err) {
        console.error("/api/diagnose error:", err);
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
