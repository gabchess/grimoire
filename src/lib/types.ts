import type { Census } from "./census";
import type { Cause, Diagnosis } from "./diagnose";
import type { ParsedEventsDecodedError } from "./helius";

/** Where the transaction data came from. "recorded" means a fixture in test/fixtures/tx, with no network call. */
export type Origin = "recorded" | "helius" | "public-rpc";

/** Helius Parsed Events as an outside check on our decode. "not-run" without a key or for recorded fixtures. */
export type ParsedEventsCheck =
  | { status: "agree" | "disagree"; decodedError: ParsedEventsDecodedError | null }
  | { status: "not-run" };

/** Body of a successful POST /api/diagnose. */
export interface DiagnoseResponse {
  signature: string;
  origin: Origin;
  slot: number;
  blockTime: number | null;
  explorerUrl: string;
  diagnosis: Diagnosis;
  parsedEvents: ParsedEventsCheck;
  logs: string[];
}

/** Body of a failed POST /api/diagnose. Never contains a URL. */
export interface DiagnoseError {
  error: string;
}

/** One click-to-try example on the page, one per cause. */
export interface ExampleChip {
  signature: string;
  cause: Cause;
  title: string;
}

/** Body of a successful POST /api/autopsy. */
export interface AutopsyResponse {
  address: string;
  source: "helius" | "public-rpc";
  /** Signatures looked at. With the public RPC this is the last `scanLimit` transactions. */
  scanned: number;
  scanLimit: number | null;
  /** Most failed transactions read in full with the public RPC. */
  fetchCap: number | null;
  /** Failed transactions the RPC would not return, even after retries. */
  skipped: number;
  census: Census;
}
