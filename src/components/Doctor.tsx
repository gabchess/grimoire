"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, Search } from "lucide-react";
import { formatSol, supportReply } from "@/lib/support-reply";
import type { DiagnoseError, DiagnoseResponse, ExampleChip, Origin, ParsedEventsCheck } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading"; signature: string }
  | { status: "done"; result: DiagnoseResponse }
  | { status: "error"; message: string };

const ORIGIN_LABEL: Record<Origin, string> = {
  recorded: "Recorded fixture",
  helius: "Helius",
  "public-rpc": "Public RPC",
};

function parsedEventsText(p: ParsedEventsCheck, ourCode: number | undefined): string {
  if (p.status === "not-run") return "Not run. It needs a live lookup with a Helius key on the server.";
  const theirs = p.decodedError?.code;
  if (p.status === "agree") return theirs === undefined ? "Agrees. Neither decode found an error code." : `Agrees on error code ${theirs}.`;
  return `Disagrees. Helius decoded ${theirs ?? "no code"}, plain code read ${ourCode ?? "no code"}.`;
}

export function Doctor({ examples }: { examples: ExampleChip[] }) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function run(signature: string) {
    const sig = signature.trim();
    if (!sig) return;
    setInput(sig);
    setState({ status: "loading", signature: sig });
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature: sig }),
      });
      const body = (await res.json()) as DiagnoseResponse | DiagnoseError;
      if (!res.ok || "error" in body) {
        setState({ status: "error", message: "error" in body ? body.error : `Request failed with HTTP ${res.status}.` });
        return;
      }
      setState({ status: "done", result: body });
    } catch {
      setState({ status: "error", message: "Could not reach the server. Check your connection and try again." });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(input);
  }

  return (
    <section aria-label="Diagnose a transaction" className="mt-10">
      <form onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="sig" className="sr-only">
          Transaction signature
        </label>
        <input
          id="sig"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a failed transaction signature"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 min-w-0 rounded-lg border border-border-default bg-input px-4 py-3 font-mono text-[0.8125rem] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus"
        />
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-5 py-3 text-[0.875rem] font-semibold text-white hover:bg-accent-purple-hover disabled:opacity-60 transition-colors duration-[120ms]"
        >
          <Search size={16} aria-hidden="true" />
          Diagnose
        </button>
      </form>

      {examples.length > 0 && (
        <div className="mt-4">
          <p className="text-[0.75rem] text-text-tertiary">Or try a real failed mainnet transaction:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex.signature}
                type="button"
                onClick={() => void run(ex.signature)}
                className="rounded-pill border border-border-default bg-elevated px-3 py-1.5 text-[0.75rem] text-text-secondary hover:border-accent-purple hover:text-text-primary transition-colors duration-[120ms]"
              >
                {ex.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div aria-live="polite" className="mt-8">
        {state.status === "loading" && <p className="text-[0.875rem] text-text-secondary">Reading the transaction...</p>}
        {state.status === "error" && (
          <p role="alert" className="rounded-lg border border-status-error/40 bg-status-error/10 px-4 py-3 text-[0.875rem] text-text-primary">
            {state.message}
          </p>
        )}
        {state.status === "done" && <ResultCard result={state.result} />}
      </div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">{label}</dt>
      <dd className="mt-1 text-[0.875rem] text-text-primary break-words">{children}</dd>
    </div>
  );
}

function ResultCard({ result }: { result: DiagnoseResponse }) {
  const d = result.diagnosis;
  const [copied, setCopied] = useState(false);
  const evidenceIdx = result.logs.indexOf(d.evidence);
  const sig = result.signature;

  async function copyReply() {
    await navigator.clipboard.writeText(supportReply(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <article className="animate-entrance rounded-xl border border-border-default bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-pill border border-accent-green/40 bg-accent-green-subtle px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-accent-green">
          {ORIGIN_LABEL[result.origin]}
        </span>
        <span className="font-mono text-[0.75rem] text-text-tertiary">slot {result.slot.toLocaleString("en-US")}</span>
      </div>

      <h2 className="mt-4 text-[1.375rem] font-bold leading-[1.25] tracking-[-0.01em]">{d.title}</h2>
      <p className="mt-3 text-[0.9375rem] text-text-secondary leading-[1.6]">{d.fix}</p>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <Fact label="Failing program">
          {d.programName ?? <span className="font-mono text-[0.8125rem]">{d.programId ?? "Not in the logs"}</span>}
        </Fact>
        <Fact label="Instruction">
          {d.instructionIndex !== undefined ? (
            <>
              Instruction #{d.instructionIndex + 1}
              <span className="block text-[0.75rem] text-text-tertiary">Same numbering as Solana Explorer.</span>
            </>
          ) : (
            "Not tied to one instruction"
          )}
        </Fact>
        {d.errorCode !== undefined && (
          <Fact label="Error code">
            <span className="font-mono">
              {d.errorCode} (0x{d.errorCode.toString(16)}){d.errorName ? ` ${d.errorName}` : ""}
            </span>
          </Fact>
        )}
        <Fact label="Fee paid">{formatSol(d.feeLamports)}</Fact>
        <Fact label="Compute units">{d.computeUnits?.toLocaleString("en-US") ?? "Not reported"}</Fact>
        <Fact label="Helius Parsed Events check">{parsedEventsText(result.parsedEvents, d.errorCode)}</Fact>
      </dl>

      <div className="mt-6">
        <p className="text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">Program logs</p>
        {evidenceIdx < 0 && (
          <p className="mt-2 rounded-md border border-status-warning/50 bg-status-warning/10 px-3 py-2 font-mono text-[0.75rem] text-text-primary break-all">
            {d.evidence}
          </p>
        )}
        <ol className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-border-subtle bg-void p-3 font-mono text-[0.71875rem] leading-[1.6]">
          {result.logs.map((line, i) => (
            <li
              key={i}
              className={
                i === evidenceIdx
                  ? "rounded bg-status-warning/15 px-1 text-text-primary outline outline-1 outline-status-warning/60 break-all"
                  : "px-1 text-text-tertiary break-all"
              }
            >
              {line}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void copyReply()}
          className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-elevated px-4 py-2 text-[0.8125rem] font-semibold text-text-primary hover:border-accent-purple transition-colors duration-[120ms]"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copied" : "Copy support reply"}
        </button>
        <a
          href={result.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] text-text-secondary hover:text-text-primary"
        >
          Solana Explorer <ExternalLink size={13} aria-hidden="true" />
        </a>
        <a
          href={`https://solscan.io/tx/${sig}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] text-text-secondary hover:text-text-primary"
        >
          Solscan <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
