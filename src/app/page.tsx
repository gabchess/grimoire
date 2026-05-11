"use client";

import Link from "next/link";
import BindBrainForm from "@/components/BindBrainForm";
import { LogoLockup } from "@/components/Logo";
import {
  X as XIcon,
  GitBranch,
  Vote,
  FileText,
  Link2,
  BookOpen,
} from "lucide-react";

const SOURCE_TILES = [
  {
    label: "X posts",
    icon: XIcon,
    color: "#1DA1F2",
  },
  {
    label: "Repos",
    icon: GitBranch,
    color: "#E6EDF3",
  },
  {
    label: "Proposals",
    icon: Vote,
    color: "#9945FF",
  },
  {
    label: "Docs",
    icon: FileText,
    color: "#FFB800",
  },
  {
    label: "Transactions",
    icon: Link2,
    color: "#14F195",
  },
  {
    label: "Glossary",
    icon: BookOpen,
    color: "#64B5F6",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-void text-text-primary">
      {/* Nav */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="sticky top-0 z-50 border-b border-border-subtle backdrop-blur-md bg-void/80"
      >
        <div className="max-w-[1120px] mx-auto px-6 py-3 flex items-center justify-between">
          <LogoLockup />
          <div className="flex items-center gap-4">
            <Link
              href="/dao/marinade"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-[120ms]"
            >
              Try demo
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-[120ms]"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        id="hero"
        className="max-w-[1120px] mx-auto px-6 pt-[120px] pb-16"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: 7 cols */}
          <div className="lg:col-span-7">
            <h1 className="text-[2.5rem] lg:text-[4rem] font-bold leading-[1.05] tracking-[-0.03em] text-text-primary animate-entrance">
              Your company brain,{" "}
              <span className="text-gradient">permanently onchain.</span>
            </h1>

            <p className="mt-6 text-[1.125rem] text-text-secondary leading-[1.6] max-w-[520px] animate-entrance [animation-delay:100ms]">
              Drop your X handle, repos, governance forum, and docs. In minutes,
              get an AI agent that answers any question about your organization,
              citing the exact source, with every answer attested on Solana.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 animate-entrance [animation-delay:200ms]">
              <a
                href="#bind-brain"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-purple px-8 py-4 text-sm font-medium text-white transition-all duration-[120ms] hover:bg-accent-purple-hover hover:shadow-[0_0_24px_rgba(153,69,255,0.3)] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2"
              >
                Build your brain
              </a>
              <Link
                href="/dao/marinade"
                aria-label="See Marinade demo"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-transparent px-4 py-3 text-sm text-text-secondary transition-all duration-[120ms] hover:border-border-strong hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2 group"
              >
                See demo
                <span
                  aria-hidden="true"
                  className="transition-transform duration-[120ms] group-hover:translate-x-0.5"
                >
                  -&gt;
                </span>
              </Link>
            </div>
          </div>

          {/* Right: 5 cols — source type tiles */}
          <div
            className="lg:col-span-5"
            role="presentation"
            aria-hidden="true"
          >
            <div className="grid grid-cols-3 gap-3">
              {SOURCE_TILES.map((tile, i) => {
                const Icon = tile.icon;
                const delay = 350 + i * 50;
                return (
                  <div
                    key={tile.label}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border-subtle bg-elevated h-20 lg:h-24 cursor-default transition-all duration-[200ms] hover:scale-[1.03] animate-entrance"
                    style={{
                      animationDelay: `${delay}ms`,
                      transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = tile.color + "66";
                      el.style.backgroundColor = tile.color + "12";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = "";
                      el.style.backgroundColor = "";
                    }}
                  >
                    <Icon
                      size={24}
                      style={{ color: tile.color }}
                      aria-hidden="true"
                    />
                    <span
                      className="text-[0.6875rem] font-medium tracking-[0.02em] text-text-tertiary"
                    >
                      {tile.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Gradient divider */}
      <div
        className="h-px w-full"
        style={{
          background: "linear-gradient(90deg, transparent, #9945FF, #14F195, transparent)",
        }}
        aria-hidden="true"
      />

      {/* Bind Brain section */}
      <section id="bind-brain" className="max-w-[1120px] mx-auto px-6 py-[120px]">
        <div className="max-w-[640px]">
          <h2 className="text-[2rem] font-semibold leading-[1.2] tracking-[-0.02em] text-text-primary">
            Feed your brain
          </h2>
          <p className="mt-3 text-[0.8125rem] text-text-secondary leading-[1.6]">
            Add your sources. One is enough to start. More sources, sharper answers.
          </p>
          <div className="mt-8">
            <BindBrainForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-[1120px] mx-auto px-6 py-12 border-t border-border-subtle">
        <p className="text-[0.6875rem] text-text-tertiary leading-relaxed">
          Solana attestations make hallucination structurally impossible. Built for{" "}
          <a
            href="https://frontier.colosseum.org"
            className="underline hover:text-text-secondary transition-colors duration-[120ms]"
            target="_blank"
            rel="noopener noreferrer"
          >
            Colosseum Frontier 2026
          </a>
          .{" "}
          <a
            href="https://github.com"
            className="underline hover:text-text-secondary transition-colors duration-[120ms]"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
