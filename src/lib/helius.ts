/**
 * Read-only Solana data client. Uses Helius when HELIUS_API_KEY is set on the
 * server, and the public RPC otherwise. Never import this from a client
 * component: the key must stay on the server.
 */

export type TxSource = "helius" | "public-rpc";

export interface RawTxMeta {
  err: unknown;
  fee: number;
  computeUnitsConsumed?: number | null;
  logMessages?: string[] | null;
  innerInstructions?: unknown[] | null;
}

export interface RawTransaction {
  slot: number;
  blockTime?: number | null;
  meta: RawTxMeta | null;
  transaction: { signatures: string[]; message: unknown };
}

export interface ParsedEventsDecodedError {
  instructionIndex?: number;
  programId?: string;
  programName?: string;
  code?: number;
  name?: string;
  msg?: string;
}

export interface ClientOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  /** Waits between retries of an HTTP 429. Tests pass [] or short delays. */
  retryDelaysMs?: number[];
  /** Gap between calls in a public RPC scan, to stay under its rate limit. */
  paceMs?: number;
}

const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
const HELIUS_HOST = "https://mainnet.helius-rpc.com";
export const PUBLIC_FAILED_SCAN_LIMIT = 100;
export const PUBLIC_FAILED_FETCH_CAP = 10;
const PUBLIC_PACE_MS = 300;

export function dataSource(env: ClientOptions["env"] = process.env): TxSource {
  return env.HELIUS_API_KEY ? "helius" : "public-rpc";
}

function rpcUrl(env: NonNullable<ClientOptions["env"]>): string {
  if (env.HELIUS_API_KEY) return `${HELIUS_HOST}/?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`;
  return env.SOLANA_RPC_MAINNET ?? PUBLIC_RPC;
}

const RETRY_DELAYS_MS = [700];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson<T>(url: string, body: unknown, f: typeof fetch, source: TxSource, delays = RETRY_DELAYS_MS): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    // The public RPC answers 429 when a client sends many calls in a row; back off and retry.
    if (res.status === 429 && attempt < delays.length) {
      await sleep(delays[attempt]);
      continue;
    }
    // Error messages name the source, never the URL, so the key cannot leak into logs or the UI.
    if (!res.ok) throw new Error(`${source} request failed with HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}

interface RpcEnvelope<T> {
  result?: T;
  error?: { code: number; message: string };
}

async function rpc<T>(method: string, params: unknown[], opts: ClientOptions): Promise<T> {
  const env = opts.env ?? process.env;
  const source = dataSource(env);
  const body = await postJson<RpcEnvelope<T>>(
    rpcUrl(env),
    { jsonrpc: "2.0", id: 1, method, params },
    opts.fetch ?? fetch,
    source,
    opts.retryDelaysMs,
  );
  if (body.error) throw new Error(`${source} ${method} error ${body.error.code}: ${body.error.message}`);
  return body.result as T;
}

const TX_CONFIG = { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "finalized" } as const;

export async function getTransaction(
  signature: string,
  opts: ClientOptions = {},
): Promise<{ source: TxSource; tx: RawTransaction | null }> {
  const tx = await rpc<RawTransaction | null>("getTransaction", [signature, TX_CONFIG], opts);
  return { source: dataSource(opts.env ?? process.env), tx };
}

export interface FailedTx {
  signature: string;
  tx: RawTransaction;
}

/**
 * Failed transactions that touched an address, newest first.
 * Helius: one getTransactionsForAddress call with the status filter.
 * Public RPC: scan recent signatures, keep the failed ones, fetch each (capped).
 */
export async function getFailedTransactions(
  address: string,
  opts: ClientOptions & { limit?: number } = {},
): Promise<{ source: TxSource; txs: FailedTx[]; scanned: number; skipped: number }> {
  const env = opts.env ?? process.env;
  const source = dataSource(env);
  const limit = opts.limit ?? PUBLIC_FAILED_FETCH_CAP;

  if (source === "helius") {
    const result = await rpc<{ data: RawTransaction[] }>(
      "getTransactionsForAddress",
      [
        address,
        {
          transactionDetails: "full",
          sortOrder: "desc",
          limit,
          encoding: "json",
          maxSupportedTransactionVersion: 1,
          filters: { status: "failed" },
        },
      ],
      opts,
    );
    const txs = (result?.data ?? [])
      .filter((tx) => tx?.meta?.err != null)
      .map((tx) => ({ signature: tx.transaction.signatures[0], tx }));
    return { source, txs, scanned: txs.length, skipped: 0 };
  }

  const sigs = await rpc<{ signature: string; err: unknown }[]>(
    "getSignaturesForAddress",
    [address, { limit: PUBLIC_FAILED_SCAN_LIMIT }],
    opts,
  );
  const failed = sigs.filter((s) => s.err != null).slice(0, limit);
  const txs: FailedTx[] = [];
  let skipped = 0;
  for (const [i, { signature }] of failed.entries()) {
    if (i > 0) await sleep(opts.paceMs ?? PUBLIC_PACE_MS);
    // One transaction that stays rate limited should not sink the whole scan; count it instead.
    const tx = await getTransaction(signature, opts).then((r) => r.tx, () => null);
    if (tx?.meta?.err != null) txs.push({ signature, tx });
    else skipped++;
  }
  return { source, txs, scanned: sigs.length, skipped };
}

interface ParsedEventsItem {
  signature: string;
  parserStatus?: string;
  parsed?: { decodedError?: ParsedEventsDecodedError | null } | null;
}

/**
 * Helius Parsed Events decodedError for each signature, used as an outside
 * check on our own decode. Returns null without a key: the public RPC has no
 * equivalent.
 */
export async function getParsedEventsErrors(
  signatures: string[],
  opts: ClientOptions = {},
): Promise<Map<string, ParsedEventsDecodedError | null> | null> {
  const env = opts.env ?? process.env;
  if (!env.HELIUS_API_KEY || signatures.length === 0) return null;
  const url = `${HELIUS_HOST}/v1/parsed-events/transactions?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`;
  const items = await postJson<ParsedEventsItem[] | { data: ParsedEventsItem[] }>(
    url,
    { transactions: signatures, includeRawTransaction: false },
    opts.fetch ?? fetch,
    "helius",
  );
  const list = Array.isArray(items) ? items : items.data;
  return new Map(list.map((i) => [i.signature, i.parsed?.decodedError ?? null]));
}
