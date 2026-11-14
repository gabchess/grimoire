/**
 * POST /api/diagnose { signature } -> DiagnoseResponse | DiagnoseError (plain JSON).
 * Recorded fixtures first (no network), then Helius or the public RPC.
 * Plain code maps the error to a cause. No AI model.
 */
import { diagnose } from "@/lib/diagnose";
import { recordedFixtures } from "@/lib/fixtures";
import { dataSource, getParsedEventsErrors, getTransaction, type RawTransaction } from "@/lib/helius";
import type { DiagnoseError, DiagnoseResponse, Origin, ParsedEventsCheck } from "@/lib/types";

// Per-IP limit on network lookups: 15 per 60 seconds, in memory, reset on cold start.
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
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

const RX_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

function fail(status: number, error: string) {
  return Response.json({ error } satisfies DiagnoseError, { status });
}

function build(
  signature: string,
  origin: Origin,
  tx: RawTransaction & { meta: NonNullable<RawTransaction["meta"]> },
  explorerUrl: string,
  parsedEvents: ParsedEventsCheck,
  diagnosis = diagnose(tx.meta),
): DiagnoseResponse {
  return {
    signature,
    origin,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    explorerUrl,
    diagnosis,
    parsedEvents,
    logs: (tx.meta.logMessages ?? []).filter((l): l is string => typeof l === "string"),
  };
}

async function crossCheck(signature: string, errorCode: number | undefined): Promise<ParsedEventsCheck> {
  try {
    const map = await getParsedEventsErrors([signature]);
    if (!map) return { status: "not-run" };
    const decodedError = map.get(signature) ?? null;
    return { status: decodedError?.code === errorCode ? "agree" : "disagree", decodedError };
  } catch (err) {
    console.error("/api/diagnose parsed events:", err instanceof Error ? err.message : "unknown error");
    return { status: "not-run" };
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { signature?: unknown };
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  if (!RX_SIGNATURE.test(signature)) {
    return fail(400, "That is not a Solana transaction signature. It should be 64 to 88 base58 characters.");
  }

  const fx = recordedFixtures().get(signature);
  if (fx?.response.meta) {
    const tx = { ...fx.response, meta: fx.response.meta };
    return Response.json(build(signature, "recorded", tx, fx.explorer_url, { status: "not-run" }));
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) return fail(429, "Too many lookups. Try again in a minute.");

  const source = dataSource();
  let tx: RawTransaction | null;
  try {
    ({ tx } = await getTransaction(signature));
  } catch (err) {
    // Log the message only: helius.ts builds messages without the URL, so the key stays out of logs.
    console.error("/api/diagnose lookup:", err instanceof Error ? err.message : "unknown error");
    return fail(502, `Could not fetch the transaction from ${source === "helius" ? "Helius" : "the public RPC"}. Try again in a minute.`);
  }
  if (!tx) return fail(404, "Transaction not found on mainnet. It may not be finalized yet, or the signature is wrong.");
  if (!tx.meta) return fail(502, "The node returned the transaction without its metadata. Try again in a minute.");
  if (tx.meta.err == null) return fail(422, "This transaction succeeded. There is no failure to diagnose.");

  const meta = tx.meta;
  const diagnosis = diagnose(meta);
  const parsedEvents = await crossCheck(signature, diagnosis.errorCode);
  return Response.json(
    build(signature, source, { ...tx, meta }, `https://explorer.solana.com/tx/${signature}`, parsedEvents, diagnosis),
  );
}
