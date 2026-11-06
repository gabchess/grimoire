import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/autopsy/route";

const fx = JSON.parse(readFileSync(join(__dirname, "fixtures", "tx", "insufficient_token_balance-2CHCzcmK.json"), "utf8"));
const post = (body: unknown, ip: string) =>
  POST(new Request("http://x/api/autopsy", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } }));

afterEach(() => vi.unstubAllGlobals());

test("rejects a value that is not an address", async () => {
  const res = await post({ address: "not-an-address" }, "1.1.1.1");
  expect(res.status).toBe(400);
});

test("groups the failed transactions of an address by cause, from the public RPC without a key", async () => {
  vi.stubEnv("HELIUS_API_KEY", "");
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    const { method } = JSON.parse(init.body);
    const result =
      method === "getSignaturesForAddress"
        ? [{ signature: fx.signature, err: fx.response.meta.err }, { signature: "ok", err: null }]
        : fx.response;
    return { ok: true, status: 200, json: async () => ({ result }) };
  });
  const res = await post({ address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, "2.2.2.2");
  const body = await res.json();
  expect(body).toMatchObject({ source: "public-rpc", scanned: 2, census: { total: 1 } });
  expect(body.census.rows[0]).toMatchObject({ cause: "insufficient_token_balance", count: 1, sampleSignature: fx.signature });
});
