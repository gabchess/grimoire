"use client";

import { useState, useRef, useEffect } from "react";
import { Send, BookOpen } from "lucide-react";
import { LogoLockup } from "@/components/Logo";
import AttestationPill from "@/components/AttestationPill";

interface GlossaryChip {
  term: string;
  category: string;
}

interface AttestationData {
  txSignature: string;
  pda: string;
  explorerUrl: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryChip[]>([]);
  const [attestation, setAttestation] = useState<AttestationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [answer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setAnswer("");
    setGlossaryTerms([]);
    setAttestation(null);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
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
              setAnswer((prev) => prev + event.text);
            } else if (event.type === "done") {
              setGlossaryTerms(event.glossaryTerms || []);
              setAttestation(event.attestation ?? null);
            } else if (event.type === "error") {
              setError(event.message || "Unknown error");
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  const hasResult = answer.length > 0 || isLoading;
  const txHash = attestation?.txSignature ?? "";
  const explorerUrl = attestation?.explorerUrl ?? "";
  const attestationReady =
    !!txHash && txHash !== "ATTESTATION_FAILED" && !!explorerUrl;

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
                Ask anything about{" "}
                <span className="text-gradient">Solana</span>
              </h1>
              <p className="mt-4 text-[1rem] text-text-secondary leading-[1.6] max-w-[520px] mx-auto">
                Every answer is grounded in the Solana glossary and permanently
                anchored onchain as a Solana attestation.
              </p>

              {/* Onchain badge */}
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-elevated px-4 py-2">
                <span
                  className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "#14F195" }}
                  aria-hidden="true"
                />
                <span className="text-[0.8125rem] text-text-secondary">
                  Every answer is anchored onchain on Solana
                </span>
              </div>
            </div>
          )}

          {/* Input form */}
          <form
            onSubmit={handleSubmit}
            className="flex gap-3 w-full"
            aria-label="Ask a Solana question"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
              placeholder="What is a Program Derived Address?"
              aria-label="Your Solana question"
              className="flex-1 h-12 rounded-xl border border-border-subtle bg-input px-4 text-[0.9375rem] text-text-primary placeholder:text-text-tertiary transition-all duration-[120ms] focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[#9945FF26] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              aria-label="Submit question"
              className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-xl transition-all duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[0.97]"
              style={{ backgroundColor: "#9945FF" }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled)
                  e.currentTarget.style.backgroundColor = "#B06AFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#9945FF";
              }}
            >
              <Send size={18} color="white" aria-hidden="true" />
            </button>
          </form>

          {/* Result area */}
          {hasResult && (
            <div
              className="mt-6 p-5 rounded-xl border border-border-subtle"
              style={{ backgroundColor: "var(--color-surface)" }}
              ref={answerRef}
            >
              {/* Agent label */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="inline-flex h-5 w-5 items-center justify-center"
                  style={{
                    backgroundColor: "rgba(153, 69, 255, 0.2)",
                    borderRadius: "4px",
                  }}
                >
                  <LogoLockup className="scale-[0.55] origin-left" />
                </div>
                <span className="text-[0.6875rem] tracking-[0.02em] text-text-tertiary">
                  Grimoire
                </span>
              </div>

              {/* Streaming answer */}
              {isLoading && !answer && (
                <div
                  aria-live="polite"
                  aria-label="Grimoire is thinking"
                  className="flex items-center gap-2 py-2"
                >
                  <span className="text-[0.8125rem] text-text-tertiary">
                    Thinking
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

              {answer && (
                <p
                  className="text-[0.9375rem] text-text-primary leading-[1.65]"
                  aria-live="polite"
                >
                  {answer}
                </p>
              )}

              {error && (
                <p className="text-[0.875rem] text-status-error mt-2">
                  {error}
                </p>
              )}

              {/* Glossary chips */}
              {glossaryTerms.length > 0 && (
                <div className="mt-4">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-text-tertiary mb-2">
                    Glossary terms used
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {glossaryTerms.map((chip) => (
                      <span
                        key={chip.term}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-3 py-1"
                      >
                        <BookOpen
                          size={12}
                          style={{ color: "#64B5F6" }}
                          aria-hidden="true"
                        />
                        <span className="text-[0.75rem] text-text-secondary">
                          {chip.term}
                        </span>
                        <span className="text-[0.6875rem] text-text-tertiary">
                          {chip.category}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Attestation */}
              {!isLoading && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[0.6875rem] text-text-tertiary">
                    Anchored:
                  </span>
                  {attestationReady ? (
                    <AttestationPill
                      txHash={txHash}
                      explorerUrl={explorerUrl}
                    />
                  ) : answer ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-overlay px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                      <span className="text-[0.8125rem] font-medium text-text-tertiary">
                        Attestation failed
                      </span>
                    </span>
                  ) : null}
                </div>
              )}
              {isLoading && answer && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[0.6875rem] text-text-tertiary">
                    Anchoring onchain...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* How it works — shown below result or below input when no result */}
          {!isLoading && (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  title: "Glossary grounding",
                  body: "1000+ Solana terms matched against your query so Claude answers with precision.",
                },
                {
                  title: "Streamed answer",
                  body: "Claude responds in real time, grounded in the matched terminology.",
                },
                {
                  title: "Onchain attestation",
                  body: "The query, answer, and source hashes are anchored as a permanent Solana PDA.",
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
        <div className="max-w-[800px] mx-auto">
          <p className="text-[0.6875rem] text-text-tertiary">
            Program:{" "}
            <a
              href="https://solana.fm/address/B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm?cluster=devnet-alpha"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-text-secondary transition-colors duration-[120ms]"
            >
              B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm
            </a>{" "}
            on Solana devnet.{" "}
            <a
              href="https://github.com/gabchess/grimoire"
              className="underline hover:text-text-secondary transition-colors duration-[120ms]"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
