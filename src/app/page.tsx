import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CensusSection } from "@/components/CensusSection";
import { Doctor } from "@/components/Doctor";
import { LogoLockup } from "@/components/Logo";
import { WalletAutopsy } from "@/components/WalletAutopsy";
import { census } from "@/lib/census";
import { exampleChips } from "@/lib/fixtures";
import type { RawTxMeta } from "@/lib/helius";

interface CensusFile {
  recorded: string;
  programs_scanned: string[];
  slot_range: [number, number];
  transactions: { signature: string; meta: RawTxMeta }[];
}

// Read at build time: this page uses no request data, so Next prerenders it and the census never reaches the browser bundle.
const CENSUS_FILE = JSON.parse(
  readFileSync(join(process.cwd(), "data", "failed-tx-census-2026-11-05.json"), "utf8"),
) as CensusFile;

export default function Home() {
  const data = census(CENSUS_FILE.transactions);
  const method = {
    recorded: CENSUS_FILE.recorded,
    programCount: CENSUS_FILE.programs_scanned.length,
    slotRange: CENSUS_FILE.slot_range,
  };
  return (
    <div className="min-h-screen bg-void text-text-primary flex flex-col">
      <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b border-border-subtle backdrop-blur-md bg-void/80">
        <div className="max-w-[860px] mx-auto px-6 py-3 flex items-center justify-between">
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

      <main className="flex-1 px-6 pt-14 pb-20">
        <div className="w-full max-w-[860px] mx-auto">
          <header className="animate-entrance">
            <h1 className="text-[2rem] lg:text-[2.75rem] font-bold leading-[1.1] tracking-[-0.03em]">
              Solana <span className="text-gradient">Transaction Doctor</span>
            </h1>
            <p className="mt-4 text-[1rem] text-text-secondary leading-[1.6] max-w-[620px]">
              Paste a failed transaction signature. Grimoire reads it through Helius, or the public RPC without a key,
              and plain code names the cause, the fix and the log line that proves it. No AI model.
            </p>
          </header>

          <Doctor examples={exampleChips()} />

          <WalletAutopsy />

          <CensusSection data={data} method={method} />
        </div>
      </main>
    </div>
  );
}
