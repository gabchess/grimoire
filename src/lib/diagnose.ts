/**
 * Maps one failed transaction to one root cause, with the log line that
 * proves it. Plain code, no model. Error codes are program-specific (0x1 means
 * "insufficient funds" in the Token program and something else elsewhere), so
 * codes are looked up by the failing program id first.
 */

import type { RawTxMeta } from "./helius";

export const CAUSES = [
  "slippage_exceeded",
  "insufficient_token_balance",
  "insufficient_lamports",
  "compute_budget_exceeded",
  "account_not_initialized",
  "anchor_constraint_violation",
  "program_custom_error",
  "unknown",
] as const;
export type Cause = (typeof CAUSES)[number];

export interface CauseInfo {
  title: string;
  fix: string;
}

export const CAUSE_INFO: Record<Cause, CauseInfo> = {
  slippage_exceeded: {
    title: "Slippage tolerance exceeded",
    fix: "The price moved past your limit before the swap landed. Retry with a fresh quote, raise slippage a little, or add a priority fee so the transaction lands sooner.",
  },
  insufficient_token_balance: {
    title: "Not enough tokens in the source account",
    fix: "The token account had fewer tokens than the transfer or swap amount. Re-read the balance right before signing, and leave room for fees and rounding.",
  },
  insufficient_lamports: {
    title: "Not enough SOL",
    fix: "The payer did not have enough SOL for the transfer, the fee or the rent of a new account. Top up the wallet, or lower the amount and keep about 0.002 SOL for rent.",
  },
  compute_budget_exceeded: {
    title: "Ran out of compute units",
    fix: "The transaction used its whole compute budget. Simulate it, then set a ComputeBudget limit about 10 to 20 percent above the units it used, or split the work into smaller transactions.",
  },
  account_not_initialized: {
    title: "An account was not initialized",
    fix: "The program expected an account that does not exist yet or holds no data. Create it first (for example the associated token account), or check that the client passes the right address.",
  },
  anchor_constraint_violation: {
    title: "An Anchor account constraint failed",
    fix: "An account did not match the program's #[account(...)] rules, such as seeds, owner, has_one or mut. Compare the accounts the client passes with the program's IDL.",
  },
  program_custom_error: {
    title: "The program returned its own error",
    fix: "Look up the error code in the program's IDL or source. The log line below names the program and the code.",
  },
  unknown: {
    title: "Cause not recognized",
    fix: "No known pattern matched. Read the program logs below from the bottom up; the last 'failed' line names the program that stopped the transaction.",
  },
};

interface ProgramError {
  name: string;
  cause: Cause;
}

interface KnownProgram {
  name: string;
  errors: Record<number, ProgramError>;
}

const TOKEN_ERRORS: Record<number, ProgramError> = {
  1: { name: "InsufficientFunds", cause: "insufficient_token_balance" },
};

// Sources: SPL Token interface/src/error.rs (InsufficientFunds = 1); Jupiter v6 errors (6001).
export const KNOWN_PROGRAMS: Record<string, KnownProgram> = {
  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: { name: "SPL Token", errors: TOKEN_ERRORS },
  TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb: { name: "Token-2022", errors: TOKEN_ERRORS },
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: {
    name: "Jupiter Aggregator v6",
    errors: { 6001: { name: "SlippageToleranceExceeded", cause: "slippage_exceeded" } },
  },
  "11111111111111111111111111111111": { name: "System Program", errors: {} },
  ComputeBudget111111111111111111111111111111: { name: "Compute Budget", errors: {} },
};

export interface Diagnosis {
  cause: Cause;
  title: string;
  fix: string;
  /** The log line or error field that proves the cause. */
  evidence: string;
  instructionIndex?: number;
  programId?: string;
  programName?: string;
  errorCode?: number;
  errorName?: string;
  feeLamports: number;
  computeUnits: number | null;
}

const RX_FAILED = /^Program (\w+) failed: (.+)$/;
const RX_CUSTOM = /custom program error: 0x([0-9a-fA-F]+)/;
const RX_ANCHOR = /AnchorError.*?Error Code: (\w+)\. Error Number: (\d+)\./;
const RX_COMPUTE = /exceeded CUs meter|Computational budget exceeded|ComputationalBudgetExceeded/;
const RX_LAMPORTS = /insufficient lamports/i;
const RX_SLIPPAGE = /slippage/i;

function instructionError(err: unknown): { index?: number; inner?: unknown } {
  if (err && typeof err === "object" && "InstructionError" in err) {
    const [index, inner] = (err as { InstructionError: [number, unknown] }).InstructionError;
    return { index, inner };
  }
  return {};
}

function customCode(inner: unknown): number | undefined {
  if (inner && typeof inner === "object" && "Custom" in inner) return (inner as { Custom: number }).Custom;
  return undefined;
}

export function diagnose(meta: RawTxMeta): Diagnosis {
  const logs = (meta.logMessages ?? []).filter((l): l is string => typeof l === "string");
  const { index, inner } = instructionError(meta.err);
  // The innermost program fails first; callers then re-report the same code, so the first "failed" line is the origin.
  const failedLine = logs.find((l) => RX_FAILED.test(l));
  const programId = failedLine?.match(RX_FAILED)?.[1];
  const program = programId ? KNOWN_PROGRAMS[programId] : undefined;
  const anchorLine = logs.find((l) => RX_ANCHOR.test(l));
  const anchor = anchorLine?.match(RX_ANCHOR);
  const hexCode = failedLine?.match(RX_CUSTOM)?.[1];
  const code = customCode(inner) ?? (hexCode ? parseInt(hexCode, 16) : undefined) ?? (anchor ? Number(anchor[2]) : undefined);
  const known = code !== undefined ? program?.errors[code] : undefined;

  const base = {
    instructionIndex: index,
    programId,
    programName: program?.name,
    errorCode: code,
    errorName: known?.name ?? anchor?.[1],
    feeLamports: meta.fee,
    computeUnits: meta.computeUnitsConsumed ?? null,
  };
  const result = (cause: Cause, evidence: string): Diagnosis => ({ cause, ...CAUSE_INFO[cause], evidence, ...base });
  const errText = JSON.stringify(meta.err);

  const computeLine = logs.find((l) => RX_COMPUTE.test(l));
  if (inner === "ComputationalBudgetExceeded" || computeLine) {
    return result("compute_budget_exceeded", computeLine ?? errText);
  }

  if (errText.includes("InsufficientFundsForFee") || errText.includes("InsufficientFundsForRent")) {
    return result("insufficient_lamports", errText);
  }
  const lamportsLine = logs.find((l) => RX_LAMPORTS.test(l));
  if (lamportsLine) return result("insufficient_lamports", lamportsLine);

  if (known) return result(known.cause, anchorLine ?? failedLine ?? errText);

  if (anchorLine && RX_SLIPPAGE.test(anchorLine)) return result("slippage_exceeded", anchorLine);

  if (code === 3012) return result("account_not_initialized", anchorLine ?? failedLine ?? errText);
  if (code !== undefined && code >= 2000 && code < 3000) {
    return result("anchor_constraint_violation", anchorLine ?? failedLine ?? errText);
  }
  if (code !== undefined) return result("program_custom_error", anchorLine ?? failedLine ?? errText);

  return result("unknown", failedLine ?? errText);
}
