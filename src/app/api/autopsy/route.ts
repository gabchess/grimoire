/**
 * POST /api/autopsy { address } -> AutopsyResponse | DiagnoseError.
 * Pulls an address's recent failed transactions (Helius getTransactionsForAddress with the
 * failed status filter, or a capped public RPC scan) and groups them by cause. No AI model.
 */
import { census } from "@/lib/census";
import { getFailedTransactions, PUBLIC_FAILED_FETCH_CAP, PUBLIC_FAILED_SCAN_LIMIT } from "@/lib/helius";
import type { AutopsyResponse, DiagnoseError } from "@/lib/types";

// Each autopsy can make up to 11 RPC calls plus retries, so the per-IP limit is tighter than /api/diagnose.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; reset: number }>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now >= entry.reset) {
    hits.set(ip, { n: 1, reset: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.n >= RATE_LIMIT_MAX) return false;
  entry.n++;
  return true;
}

const RX_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function fail(status: number, error: string) {
  return Response.json({ error } satisfies DiagnoseError, { status });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { address?: unknown } | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!RX_ADDRESS.test(address)) return fail(400, "That is not a Solana address. It should be 32 to 44 base58 characters.");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowed(ip)) return fail(429, "Too many wallet lookups. Wait a minute and try again.");

  try {
    const { source, txs, scanned, skipped } = await getFailedTransactions(address, { limit: PUBLIC_FAILED_FETCH_CAP });
    const res: AutopsyResponse = {
      address,
      source,
      scanned,
      scanLimit: source === "helius" ? null : PUBLIC_FAILED_SCAN_LIMIT,
      fetchCap: source === "helius" ? null : PUBLIC_FAILED_FETCH_CAP,
      skipped,
      census: census(txs.map(({ signature, tx }) => ({ signature, meta: tx.meta! }))),
    };
    return Response.json(res);
  } catch (err) {
    // helius.ts error messages name the source and status, never the URL.
    console.error("autopsy failed:", err instanceof Error ? err.message : err);
    return fail(502, "The RPC did not answer. The public RPC rate limits often; try again in a minute.");
  }
}
