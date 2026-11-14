import type { Census } from "@/lib/census";
import { formatSol } from "@/lib/support-reply";

export interface CensusMethod {
  recorded: string;
  programCount: number;
  slotRange: [number, number];
}

function percent(n: number, total: number): string {
  return `${((n / total) * 100).toFixed(1)}%`;
}

export function CensusSection({ data, method }: { data: Census; method: CensusMethod }) {
  const max = data.rows[0]?.count ?? 1;
  const rest = data.total - data.named;
  return (
    <section aria-labelledby="census-heading" className="mt-20">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-accent-green">Failure census</p>
      <h2 id="census-heading" className="mt-2 text-[1.5rem] lg:text-[1.75rem] font-bold leading-[1.2] tracking-[-0.02em]">
        Plain code names a specific cause for {data.named} of {data.total} real failed mainnet transactions
      </h2>
      <p className="mt-3 text-[0.9375rem] text-text-secondary leading-[1.6]">
        These {data.total} failed transactions paid {formatSol(data.feeLamports)} in fees and got nothing done.
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {data.rows.map((row) => (
          <li key={row.cause}>
            <div className="flex items-baseline justify-between gap-4 text-[0.875rem]">
              <span className="text-text-primary">{row.title}</span>
              <span className="font-mono text-text-secondary tabular-nums whitespace-nowrap">
                {row.count} <span className="text-text-tertiary">({percent(row.count, data.total)})</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-pill bg-elevated overflow-hidden" aria-hidden="true">
              <div
                className="h-full rounded-pill"
                style={{
                  width: `${(row.count / max) * 100}%`,
                  background:
                    row.cause === "program_custom_error" || row.cause === "unknown"
                      ? "var(--color-border-strong)"
                      : "linear-gradient(90deg, #9945FF, #14F195)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[0.875rem] text-text-secondary leading-[1.6]">
        The other {rest} are program-specific errors. Each one needs that program&apos;s own error list to decode. Helius
        Parsed Events returns a decoded error when it has that program&apos;s error metadata. Grimoire shows that check
        next to its own answer when a Helius key is set.
      </p>
      <p className="mt-3 text-[0.8125rem] text-text-tertiary leading-[1.6]">
        Method: recorded {method.recorded} from the public Solana RPC, on {method.programCount} busy DeFi programs, slots{" "}
        {method.slotRange[0].toLocaleString("en-US")} to {method.slotRange[1].toLocaleString("en-US")}. This is not a
        random sample of all Solana failures.
      </p>
    </section>
  );
}
