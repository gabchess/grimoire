import Link from "next/link";
import BindBrainForm from "@/components/BindBrainForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold text-indigo-400">Oblivion</span>
          <Link
            href="/dao/marinade"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Try demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-5xl font-bold tracking-tight leading-tight text-white">
          Oblivion: the company brain<br />
          <span className="text-indigo-400">for Solana DAOs</span>
        </h1>

        <p className="mt-6 text-xl text-slate-300 max-w-2xl leading-relaxed">
          Drop your governance forum URL. Within 5 minutes, get an AI agent
          that answers any question about your DAO&apos;s decision history,
          with citations linking to specific governance proposals and onchain
          Solana attestations proving the source document.
        </p>

        {/* Killer feature cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-6">
            <h3 className="font-semibold text-indigo-300 text-lg">Every answer grounded</h3>
            <p className="mt-2 text-slate-400 text-sm leading-relaxed">
              Each response cites the specific proposals and forum threads it
              drew from. No confident guessing. No context collapse.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
            <h3 className="font-semibold text-slate-200 text-lg">Every source verifiable</h3>
            <p className="mt-2 text-slate-400 text-sm leading-relaxed">
              Source documents are SHA-256 hashed and written to Solana at
              index time. Anyone can verify the agent did not drift from
              the original.
            </p>
          </div>
        </div>

        {/* Bind brain form */}
        <div className="mt-14">
          <h2 className="text-lg font-medium text-slate-200 mb-3">
            Bind a brain to your DAO
          </h2>
          <BindBrainForm />
          <p className="mt-2 text-xs text-slate-500">
            Indexing takes 3 to 5 minutes. Pre-indexed demo available below.
          </p>
        </div>

        {/* Demo CTA */}
        <div className="mt-10">
          <Link
            href="/dao/marinade"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-700 bg-indigo-950/60 px-6 py-3 text-sm font-medium text-indigo-300 hover:bg-indigo-900/60 hover:text-indigo-200 transition-colors"
          >
            Try Marinade demo
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-800 mt-12">
        <p className="text-xs text-slate-500 leading-relaxed">
          Solana attestations make hallucination plausibility removed structurally.
          Built for{" "}
          <a
            href="https://frontier.colosseum.org"
            className="underline hover:text-slate-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Colosseum Frontier 2026
          </a>
          .{" "}
          <a href="#" className="underline hover:text-slate-300">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
