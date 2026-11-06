import { describe, expect, test } from "vitest";
import { getFailedTransactions, getParsedEventsErrors, getTransaction } from "@/lib/helius";

type Call = { url: string; body: { method?: string; params?: unknown[]; transactions?: string[] } };

function fakeFetch(respond: (call: Call) => unknown, status = 200) {
  const calls: Call[] = [];
  const f = (async (url: string, init: { body: string }) => {
    const call = { url, body: JSON.parse(init.body) };
    calls.push(call);
    return { ok: status < 400, status, json: async () => respond(call) };
  }) as unknown as typeof fetch;
  return { f, calls };
}

const failedTx = (sig: string) => ({
  slot: 1,
  meta: { err: { InstructionError: [0, { Custom: 1 }] }, fee: 5000, logMessages: [] },
  transaction: { signatures: [sig], message: {} },
});

describe("data source selection", () => {
  test("without a key, getTransaction calls the public RPC", async () => {
    const { f, calls } = fakeFetch(() => ({ result: failedTx("s1") }));
    const out = await getTransaction("s1", { env: {}, fetch: f });
    expect(out.source).toBe("public-rpc");
    expect(calls[0].url).toBe("https://api.mainnet-beta.solana.com");
    expect(calls[0].body.method).toBe("getTransaction");
  });

  test("with a key, getTransaction calls Helius", async () => {
    const { f, calls } = fakeFetch(() => ({ result: failedTx("s1") }));
    const out = await getTransaction("s1", { env: { HELIUS_API_KEY: "k" }, fetch: f });
    expect(out.source).toBe("helius");
    expect(calls[0].url.startsWith("https://mainnet.helius-rpc.com/")).toBe(true);
  });
});

describe("getFailedTransactions", () => {
  test("with a key, asks Helius getTransactionsForAddress for failed txs only", async () => {
    const { f, calls } = fakeFetch(() => ({ result: { data: [failedTx("a"), failedTx("b")] } }));
    const out = await getFailedTransactions("Addr", { env: { HELIUS_API_KEY: "k" }, fetch: f });
    expect(calls).toHaveLength(1);
    expect(calls[0].body.method).toBe("getTransactionsForAddress");
    expect(calls[0].body.params?.[1]).toMatchObject({ transactionDetails: "full", filters: { status: "failed" } });
    expect(out.txs.map((t) => t.signature)).toEqual(["a", "b"]);
  });

  test("without a key, scans signatures and fetches only the failed ones", async () => {
    const { f, calls } = fakeFetch((c) =>
      c.body.method === "getSignaturesForAddress"
        ? { result: [{ signature: "ok", err: null }, { signature: "bad", err: { InstructionError: [0, { Custom: 1 }] } }] }
        : { result: failedTx("bad") },
    );
    const out = await getFailedTransactions("Addr", { env: {}, fetch: f });
    expect(out.source).toBe("public-rpc");
    expect(out.scanned).toBe(2);
    expect(out.txs.map((t) => t.signature)).toEqual(["bad"]);
    expect(calls.map((c) => c.body.method)).toEqual(["getSignaturesForAddress", "getTransaction"]);
  });
});

test("HTTP errors never include the API key", async () => {
  const { f } = fakeFetch(() => ({}), 403);
  await expect(getTransaction("s", { env: { HELIUS_API_KEY: "secret-key-123" }, fetch: f })).rejects.toThrow(
    /^helius request failed with HTTP 403$/,
  );
});

test("Parsed Events is skipped without a key and keyed by signature with one", async () => {
  expect(await getParsedEventsErrors(["s"], { env: {} })).toBeNull();
  const { f, calls } = fakeFetch(() => [
    { signature: "s", parserStatus: "OK", parsed: { decodedError: { code: 6001, name: "SlippageToleranceExceeded" } } },
  ]);
  const out = await getParsedEventsErrors(["s"], { env: { HELIUS_API_KEY: "k" }, fetch: f });
  expect(calls[0].url).toContain("/v1/parsed-events/transactions");
  expect(out?.get("s")?.name).toBe("SlippageToleranceExceeded");
});

test("retries an HTTP 429 from the public RPC, then succeeds", async () => {
  let n = 0;
  const f = (async () => {
    n++;
    return n === 1
      ? { ok: false, status: 429, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ result: failedTx("s") }) };
  }) as unknown as typeof fetch;
  const out = await getTransaction("s", { env: {}, fetch: f, retryDelaysMs: [0] });
  expect(n).toBe(2);
  expect(out.tx?.transaction.signatures[0]).toBe("s");
});

test("a failed scan keeps the transactions it could read and counts the rest as skipped", async () => {
  const f = (async (_u: string, init: { body: string }) => {
    const { method, params } = JSON.parse(init.body);
    if (method === "getSignaturesForAddress")
      return { ok: true, status: 200, json: async () => ({ result: [{ signature: "a", err: {} }, { signature: "b", err: {} }] }) };
    if (params[0] === "b") return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ result: failedTx("a") }) };
  }) as unknown as typeof fetch;
  const out = await getFailedTransactions("Addr", { env: {}, fetch: f, retryDelaysMs: [] });
  expect(out.txs.map((t) => t.signature)).toEqual(["a"]);
  expect(out.skipped).toBe(1);
});
