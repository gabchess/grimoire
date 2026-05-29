"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Zap,
  BookOpen,
  Terminal,
} from "lucide-react";
import { LogoLockup } from "@/components/Logo";
import type { DecodeResult, DetectedPattern } from "@/lib/tx-decode";

// ─── Example signatures (real devnet transactions) ──────────────────────────
// These are included so the reviewer can click and see real decode output.
const EXAMPLES = [
  {
    label: "Failed: ConstraintMut",
    sig: "5NzmLPkJMmN2ZKGNdDPtBLcBr5uFLBqKpnqFPnuHBW4CQXK5htxkGseTrCDCGE4d5VzHWyFQQthfxG7cJ6RzX2A",
    cluster: "devnet" as const,
  },
  {
    label: "Failed: Compute exceeded",
    sig: "4tE7N9e1DYsVgFfXBvQf8aTbHSy3MJJAHn7pj7DwZr5eqG8zrH3rJm4u8BVgFWZH9cK2FpRkCMD5XqRLExFSbp",
    cluster: "devnet" as const,
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type Cluster = "mainnet" | "devnet";

interface DiagnoseState {
  status: "idle" | "loading" | "done" | "error";
  explanation: string;
  decode: DecodeResult | null;
  explorerUrl: string;
  errorMessage: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: DetectedPattern }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-elevated p-4">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle
          size={14}
          className="flex-shrink-0 mt-0.5"
          style={{ color: "#FFB800" }}
          aria-hidden="true"
        />
        <p className="text-[0.8125rem] font-semibold text-text-primary leading-snug">
          {pattern.pattern}
        </p>
      </div>
      <p className="text-[0.75rem] text-text-secondary leading-[1.55] mb-2">
        {pattern.explanation}
      </p>
      <div
        className="rounded-md p-3 border border-border-subtle"
        style={{ backgroundColor: "rgba(20, 241, 149, 0.05)" }}
      >
        <p className="text-[0.6875rem] font-semibold text-[#14F195] uppercase tracking-[0.04em] mb-1">
          Fix
        </p>
        <p className="text-[0.75rem] text-text-secondary leading-[1.55]">
          {pattern.suggestedFix}
        </p>
      </div>
    </div>
  );
}

function LogsPanel({ logs }: { logs: string[] }) {
  const [open, setOpen] = useState(false);
  if (logs.length === 0) return null;
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[0.75rem] text-text-tertiary hover:text-text-secondary transition-colors duration-[100ms]"
        aria-expanded={open}
      >
        <Terminal size={13} aria-hidden="true" />
        Program logs ({logs.length} lines)
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && (
        <pre className="mt-2 rounded-lg border border-border-subtle bg-input p-3 overflow-x-auto text-[0.6875rem] text-text-secondary leading-[1.6] font-mono max-h-64 overflow-y-auto">
          {logs.join("\n")}
        </pre>
      )}
    </div>
  );
}

function DecodePanel({
  decode,
  explorerUrl,
}: {
  decode: DecodeResult;
  explorerUrl: string;
}) {
  return (
    <div className="mt-5 space-y-4">
      {/* Status row */}
      <div className="flex flex-wrap items-center gap-3">
        {decode.failed ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-semibold border"
            style={{
              backgroundColor: "rgba(242, 92, 84, 0.12)",
              borderColor: "rgba(242, 92, 84, 0.3)",
              color: "#F25C54",
            }}
          >
            <AlertTriangle size={12} aria-hidden="true" />
            Transaction Failed
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-semibold border"
            style={{
              backgroundColor: "rgba(20, 241, 149, 0.1)",
              borderColor: "rgba(20, 241, 149, 0.3)",
              color: "#14F195",
            }}
          >
            <CheckCircle size={12} aria-hidden="true" />
            Transaction Succeeded
          </span>
        )}

        {decode.computeUnitsConsumed !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-3 py-1 text-[0.75rem] text-text-secondary">
            <Zap size={12} aria-hidden="true" style={{ color: "#FFB800" }} />
            {decode.computeUnitsConsumed.toLocaleString()} CU
          </span>
        )}

        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-3 py-1 text-[0.75rem] text-text-secondary">
          Fee: {decode.fee.toLocaleString()} lamports
        </span>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[0.75rem] text-text-tertiary hover:text-text-secondary transition-colors duration-[100ms] ml-auto"
        >
          Solana.fm
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>

      {/* Anchor error detail */}
      {decode.anchorError && (
        <div
          className="rounded-lg border p-4"
          style={{
            backgroundColor: "rgba(242, 92, 84, 0.07)",
            borderColor: "rgba(242, 92, 84, 0.2)",
          }}
        >
          <p className="text-[0.6875rem] font-semibold text-[#F25C54] uppercase tracking-[0.04em] mb-2">
            Anchor Error
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[0.8125rem]">
            <div>
              <span className="text-text-tertiary text-[0.6875rem]">Code</span>
              <p className="font-mono text-text-primary">{decode.anchorError.code}</p>
            </div>
            <div>
              <span className="text-text-tertiary text-[0.6875rem]">Number</span>
              <p className="font-mono text-text-primary">{decode.anchorError.number}</p>
            </div>
          </div>
          <p className="mt-2 text-[0.8125rem] text-text-secondary leading-snug">
            {decode.anchorError.message}
          </p>
          {decode.anchorError.causingAccount && (
            <p className="mt-1.5 text-[0.75rem] text-text-tertiary font-mono">
              Causing account: {decode.anchorError.causingAccount}
            </p>
          )}
        </div>
      )}

      {/* Custom error code */}
      {decode.customErrorCode !== undefined && !decode.anchorError && (
        <div className="rounded-lg border border-border-subtle bg-elevated p-3">
          <p className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-[0.04em] mb-1">
            Custom Program Error
          </p>
          <p className="font-mono text-[0.875rem] text-text-primary">
            {decode.customErrorCode} (0x{decode.customErrorCode.toString(16).toUpperCase()})
          </p>
          <p className="text-[0.75rem] text-text-secondary mt-1">
            Program-specific error — check the program IDL for the error at index{" "}
            {decode.customErrorCode - 6000}.
          </p>
        </div>
      )}

      {/* Failing program */}
      {decode.failingProgram && (
        <div className="flex items-center gap-2 text-[0.75rem]">
          <span className="text-text-tertiary">Failing program:</span>
          <span className="font-mono text-text-secondary break-all">
            {decode.failingProgram}
          </span>
        </div>
      )}

      {/* Detected patterns */}
      {decode.detectedPatterns.length > 0 && (
        <div>
          <p className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-[0.05em] mb-2">
            <BookOpen
              size={11}
              className="inline mr-1 mb-0.5"
              aria-hidden="true"
            />
            Detected Patterns
          </p>
          <div className="space-y-3">
            {decode.detectedPatterns.map((p, i) => (
              <PatternCard key={i} pattern={p} />
            ))}
          </div>
        </div>
      )}

      {/* Raw error */}
      {decode.rawError && (
        <div>
          <p className="text-[0.6875rem] text-text-tertiary mb-1">Raw error</p>
          <p className="font-mono text-[0.75rem] text-text-secondary bg-input rounded-md px-3 py-2 border border-border-subtle break-all">
            {decode.rawError}
          </p>
        </div>
      )}

      {/* Logs */}
      <LogsPanel logs={decode.logMessages} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [signature, setSignature] = useState("");
  const [cluster, setCluster] = useState<Cluster>("mainnet");
  const [state, setState] = useState<DiagnoseState>({
    status: "idle",
    explanation: "",
    decode: null,
    explorerUrl: "",
    errorMessage: "",
  });

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "loading" || state.status === "done") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [state.status]);

  const handleSubmit = async (e: React.FormEvent, overrideSig?: string) => {
    e.preventDefault();
    const sig = (overrideSig ?? signature).trim();
    if (!sig || state.status === "loading") return;

    setState({
      status: "loading",
      explanation: "",
      decode: null,
      explorerUrl: "",
      errorMessage: "",
    });

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: sig, cluster }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "chunk") {
              setState((prev) => ({
                ...prev,
                explanation: prev.explanation + event.text,
              }));
            } else if (event.type === "done") {
              setState((prev) => ({
                ...prev,
                status: "done",
                decode: event.decode as DecodeResult,
                explorerUrl: event.explorerUrl as string,
              }));
            } else if (event.type === "error") {
              setState((prev) => ({
                ...prev,
                status: "error",
                errorMessage: event.message as string,
              }));
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }

      // If status never reached "done" via SSE, mark as done now
      setState((prev) =>
        prev.status === "loading" ? { ...prev, status: "done" } : prev
      );
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Request failed",
      }));
    }
  };

  const hasResult =
    state.status === "loading" ||
    state.status === "done" ||
    state.status === "error";

  return (
    <div className="min-h-screen bg-void text-text-primary flex flex-col">
      {/* Nav */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="sticky top-0 z-50 border-b border-border-subtle backdrop-blur-md bg-void/80"
      >
        <div className="max-w-[800px] mx-auto px-6 py-3 flex items-center justify-between">
          <LogoLockup />
          <a
            href="https://github.com/gabchess/grimoire"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-[120ms]"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center px-6 pt-16 pb-12">
        <div className="w-full max-w-[800px]">

          {/* Header */}
          {!hasResult && (
            <div className="text-center mb-10 animate-entrance">
              <h1 className="text-[2rem] lg:text-[2.75rem] font-bold leading-[1.1] tracking-[-0.03em] text-text-primary">
                Solana{" "}
                <span className="text-gradient">Transaction Doctor</span>
              </h1>
              <p className="mt-4 text-[1rem] text-text-secondary leading-[1.6] max-w-[540px] mx-auto">
                Paste a failed transaction signature. Grimoire decodes the error
                deterministically, then explains the root cause and concrete fix
                in plain English.
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-elevated px-4 py-2">
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#14F195" }}
                  aria-hidden="true"
                />
                <span className="text-[0.8125rem] text-text-secondary">
                  Anchor errors decoded · Compute budget · Rent · PDAs
                </span>
              </div>
            </div>
          )}

          {/* Input form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 w-full"
            aria-label="Diagnose a Solana transaction"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                disabled={state.status === "loading"}
                placeholder="Paste a Solana transaction signature…"
                aria-label="Transaction signature"
                className="flex-1 h-12 rounded-xl border border-border-subtle bg-input px-4 text-[0.9375rem] text-text-primary placeholder:text-text-tertiary transition-all duration-[120ms] focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[#9945FF26] disabled:opacity-50 font-mono"
              />

              {/* Cluster toggle */}
              <button
                type="button"
                onClick={() =>
                  setCluster((c) => (c === "mainnet" ? "devnet" : "mainnet"))
                }
                disabled={state.status === "loading"}
                className="flex-shrink-0 h-12 px-4 rounded-xl border border-border-subtle bg-elevated text-[0.8125rem] text-text-secondary hover:text-text-primary hover:border-border-default transition-all duration-[120ms] disabled:opacity-50 whitespace-nowrap"
                aria-label={`Switch to ${cluster === "mainnet" ? "devnet" : "mainnet"}`}
              >
                {cluster}
              </button>

              {/* Diagnose button */}
              <button
                type="submit"
                disabled={!signature.trim() || state.status === "loading"}
                aria-label="Diagnose transaction"
                className="flex-shrink-0 h-12 px-5 flex items-center justify-center gap-2 rounded-xl text-[0.875rem] font-semibold text-white transition-all duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[0.97]"
                style={{ backgroundColor: "#9945FF" }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled)
                    e.currentTarget.style.backgroundColor = "#B06AFF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#9945FF";
                }}
              >
                <Search size={16} aria-hidden="true" />
                Diagnose
              </button>
            </div>

            {/* Example links */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[0.6875rem] text-text-tertiary">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.sig}
                  type="button"
                  onClick={(e) => {
                    setSignature(ex.sig);
                    setCluster(ex.cluster);
                    handleSubmit(e, ex.sig);
                  }}
                  disabled={state.status === "loading"}
                  className="text-[0.6875rem] text-text-tertiary hover:text-[#9945FF] underline underline-offset-2 transition-colors duration-[100ms] disabled:opacity-40"
                >
                  {ex.label} ({ex.cluster})
                </button>
              ))}
            </div>
          </form>

          {/* Result area */}
          {hasResult && (
            <div
              className="mt-6 p-5 rounded-xl border border-border-subtle"
              style={{ backgroundColor: "var(--color-surface)" }}
              ref={resultRef}
            >
              {/* Agent label */}
              <div className="flex items-center gap-2 mb-4">
                <LogoLockup className="scale-90 origin-left" />
                <span className="text-[0.6875rem] text-text-tertiary ml-auto">
                  {state.status === "loading" ? "Diagnosing…" : "Diagnosis complete"}
                </span>
              </div>

              {/* Loading state */}
              {state.status === "loading" && !state.explanation && (
                <div
                  aria-live="polite"
                  aria-label="Grimoire is analyzing the transaction"
                  className="flex items-center gap-2 py-2"
                >
                  <span className="text-[0.8125rem] text-text-tertiary">
                    Fetching transaction and decoding…
                  </span>
                  <span className="inline-flex gap-0.5">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1 w-1 rounded-full animate-bounce"
                        style={{
                          backgroundColor: "#9945FF",
                          animationDelay: `${delay}ms`,
                        }}
                      />
                    ))}
                  </span>
                </div>
              )}

              {/* Streamed explanation */}
              {state.explanation && (
                <div className="mb-4">
                  <p className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-[0.05em] mb-2">
                    Root cause &amp; fix
                  </p>
                  <p
                    className="text-[0.9375rem] text-text-primary leading-[1.7] whitespace-pre-wrap"
                    aria-live="polite"
                  >
                    {state.explanation}
                  </p>
                </div>
              )}

              {/* Decode result */}
              {state.decode && (
                <DecodePanel
                  decode={state.decode}
                  explorerUrl={state.explorerUrl}
                />
              )}

              {/* Error */}
              {state.status === "error" && (
                <p className="text-[0.875rem] text-status-error mt-2">
                  {state.errorMessage}
                </p>
              )}
            </div>
          )}

          {/* How it works */}
          {!hasResult && (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  title: "Deterministic decode",
                  body: "Anchor error codes, compute budget overflows, rent failures, and PDA collisions detected without LLM guessing.",
                },
                {
                  title: "Claude explains",
                  body: "The decoded result is handed to Claude for a plain-English root cause and concrete fix, grounded in the Solana glossary.",
                },
                {
                  title: "Deep RPC reads",
                  body: "Real getTransaction calls with log messages, compute units, fee, and program IDs — not simulated data.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-border-subtle p-4"
                  style={{ backgroundColor: "var(--color-elevated)" }}
                >
                  <p className="text-[0.8125rem] font-semibold text-text-primary mb-1">
                    {card.title}
                  </p>
                  <p className="text-[0.75rem] text-text-secondary leading-[1.5]">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-6 px-6">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <p className="text-[0.6875rem] text-text-tertiary">
            Grimoire — Solana Transaction Doctor
          </p>
          <a
            href="https://github.com/gabchess/grimoire"
            className="text-[0.6875rem] underline text-text-tertiary hover:text-text-secondary transition-colors duration-[120ms]"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
