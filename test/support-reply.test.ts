import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { diagnose } from "@/lib/diagnose";
import type { RawTransaction } from "@/lib/helius";
import { supportReply } from "@/lib/support-reply";
import type { DiagnoseResponse } from "@/lib/types";

const fx = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "tx", "slippage_exceeded-22fygFWb.json"), "utf8"),
) as { signature: string; explorer_url: string; response: RawTransaction };

const response: DiagnoseResponse = {
  signature: fx.signature,
  origin: "recorded",
  slot: fx.response.slot,
  blockTime: fx.response.blockTime ?? null,
  explorerUrl: fx.explorer_url,
  diagnosis: diagnose(fx.response.meta!),
  parsedEvents: { status: "not-run" },
  logs: fx.response.meta!.logMessages ?? [],
};

test("support reply names the cause, the Explorer instruction number, the proof, the fix and the link", () => {
  const reply = supportReply(response);
  const d = response.diagnosis;
  expect(reply).toContain(d.title);
  expect(reply).toContain(`instruction #${d.instructionIndex! + 1}`);
  expect(reply).toContain(d.evidence);
  expect(reply).toContain(d.fix);
  expect(reply).toContain(fx.explorer_url);
});

test("support reply is deterministic", () => {
  expect(supportReply(response)).toBe(supportReply(response));
});
