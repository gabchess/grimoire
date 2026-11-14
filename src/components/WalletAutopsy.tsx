"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, Search } from "lucide-react";
import { formatSol } from "@/lib/support-reply";
import type { AutopsyResponse, DiagnoseError } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: AutopsyResponse }
  | { status: "error"; message: string };

export function WalletAutopsy() {
  const [address, setAddress] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/autopsy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const body = (await res.json()) as AutopsyResponse | DiagnoseError;
      if ("error" in body) setState({ status: "error", message: body.error });
      else setState({ status: "done", result: body });
    } catch {
      setState({ status: "error", message: "Could not reach the server." });
    }
  }

  return (
    <section className="mt-16" aria-labelledby="autopsy-title">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-accent-green">Wallet autopsy</p>
      <h2 id="autopsy-title" className="mt-2 text-[1.5rem] font-bold leading-[1.25] tracking-[-0.01em]">
        Why does this wallet keep failing?
      </h2>
      <p className="mt-2 text-[0.9375rem] text-text-secondary leading-[1.6] max-w-[620px]">
        Paste a wallet or program address. Grimoire pulls its recent failed transactions, groups them by cause and adds
        up the fees they burned.
      </p>
      <form onSubmit={onSubmit} className="mt-5 flex gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Wallet or program address"
          aria-label="Solana address"
          className="flex-1 min-w-0 rounded-lg border border-border-default bg-surface px-4 py-3 font-mono text-[0.8125rem] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-purple"
        />
        <button
          type="submit"
          disabled={state.status === "loading" || address.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Search size={16} aria-hidden />
          {state.status === "loading" ? "Scanning" : "Run autopsy"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="alert" className="mt-4 text-[0.875rem] text-status-error">
          {state.message}
        </p>
      )}
      {state.status === "done" && <AutopsyResult result={state.result} />}
    </section>
  );
}

function AutopsyResult({ result }: { result: AutopsyResponse }) {
  const c = result.census;
  const scope =
    result.source === "helius"
      ? "Source: Helius getTransactionsForAddress with the failed status filter."
      : `Source: public RPC, the last ${result.scanned} transactions of this address (up to ${result.scanLimit}), at most ${result.fetchCap} failed ones read. A Helius key on the server unlocks the full failed history.`;
  const skippedNote = result.skipped > 0 ? ` ${result.skipped} failed transactions were skipped because the RPC rate limited them.` : "";

  if (c.total === 0) {
    return (
      <div className="mt-6 rounded-xl border border-border-default bg-surface p-6">
        <p className="text-[1rem] font-semibold">No failed transactions found.</p>
        <p className="mt-2 text-[0.8125rem] text-text-tertiary">{scope}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 animate-entrance rounded-xl border border-border-default bg-surface p-6">
      <p className="text-[1.125rem] font-semibold leading-[1.4]">
        {c.total} failed transactions burned {formatSol(c.feeLamports)} in fees.
      </p>
      <ul className="mt-5 space-y-4">
        {c.rows.map((r) => (
          <li key={r.cause}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.9375rem] font-medium">{r.title}</span>
              <span className="font-mono text-[0.75rem] text-text-tertiary">
                {r.count} tx, {formatSol(r.feeLamports)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-border-subtle">
              <div className="h-1.5 rounded-full bg-accent-purple" style={{ width: `${(100 * r.count) / c.total}%` }} />
            </div>
            <p className="mt-1.5 text-[0.8125rem] text-text-secondary leading-[1.55]">{r.fix}</p>
            <a
              href={`https://explorer.solana.com/tx/${r.sampleSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-mono text-[0.71875rem] text-text-tertiary hover:text-text-primary"
            >
              Example {r.sampleSignature.slice(0, 8)} <ExternalLink size={11} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[0.75rem] text-text-tertiary">{scope}{skippedNote}</p>
    </div>
  );
}
