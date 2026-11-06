/**
 * Maps one failed transaction to one root cause, with the log line that
 * proves it. Plain code, no model. Error codes are program-specific (0x1 means
 * "insufficient funds" in the Token program and something else elsewhere), so
 * codes are looked up by the failing program id first, and Anchor framework
 * codes count only when that program logged an AnchorError.
 */

import type { RawTxMeta } from "./helius";

export const CAUSES = [
  "slippage_exceeded",
  "insufficient_token_balance",
  "insufficient_lamports",
  "compute_budget_exceeded",
  "account_not_initialized",
  "wrong_account_passed",
  "missing_signature",
  "instruction_rejected",
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
    fix: "An account did not have enough SOL for the transfer, the fee or the rent of a new account. Top up the wallet, or lower the amount and keep about 0.002 SOL for rent.",
  },
  compute_budget_exceeded: {
    title: "Ran out of compute units",
    fix: "The transaction used its whole compute budget. Simulate it, then set a ComputeBudget limit about 10 to 20 percent above the units it used, or split the work into smaller transactions.",
  },
  account_not_initialized: {
    title: "An account was not initialized",
    fix: "The program expected an account that does not exist yet or holds no data. Create it first (for example the associated token account), or check that the client passes the right address.",
  },
  wrong_account_passed: {
    title: "Wrong account passed",
    fix: "An account had the wrong owner or type for this instruction. Check the account order and addresses against the program's IDL, and that token accounts belong to the right mint and token program.",
  },
  missing_signature: {
    title: "A required signer did not sign",
    fix: "The program needed an account to sign, and it did not. Add that keypair or wallet as a signer, or pass the account the program expects as the authority.",
  },
  instruction_rejected: {
    title: "The program did not accept this instruction",
    fix: "The instruction data did not match what the deployed program expects. This usually means a stale SDK or IDL after a program upgrade, or the wrong program id. Update the client and rebuild the instruction.",
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
    fix: "No known pattern matched. Read the program logs below from the top; the first 'failed' line names the program that stopped the transaction.",
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
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": { name: "pump.fun", errors: {} },
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: { name: "pump.fun AMM", errors: {} },
  KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD: { name: "Kamino Lend", errors: {} },
  dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH: { name: "Drift v2", errors: {} },
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: { name: "Orca Whirlpool", errors: {} },
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: { name: "Raydium CLMM", errors: {} },
  CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C: { name: "Raydium CPMM", errors: {} },
  LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo: { name: "Meteora DLMM", errors: {} },
};

// Builtin InstructionError variants (anza-xyz/solana-sdk instruction-error/src/lib.rs).
const BUILTIN_CAUSES: Record<string, Cause> = {
  InsufficientFunds: "insufficient_lamports",
  UninitializedAccount: "account_not_initialized",
  InvalidInstructionData: "instruction_rejected",
  IllegalOwner: "wrong_account_passed",
  InvalidAccountOwner: "wrong_account_passed",
  IncorrectProgramId: "wrong_account_passed",
  InvalidAccountData: "wrong_account_passed",
  MissingRequiredSignature: "missing_signature",
  ComputationalBudgetExceeded: "compute_budget_exceeded",
};

// Anchor framework codes (anchor lang/error/src/lib.rs), counted only with an AnchorError line.
function anchorCause(code: number): Cause | undefined {
  if (code >= 100 && code <= 103) return "instruction_rejected";
  if (code >= 2000 && code < 3000) return "anchor_constraint_violation";
  if (code === 3001 || code === 3012) return "account_not_initialized";
  if (code === 3002 || code === 3007 || code === 3008 || code === 3014) return "wrong_account_passed";
  if (code === 3005) return "instruction_rejected";
  if (code === 3010) return "missing_signature";
  return undefined;
}

export interface Diagnosis {
  cause: Cause;
  title: string;
  fix: string;
  /** The log line or error field that proves the cause. */
  evidence: string;
  /** Zero-based, as in meta.err. Solana Explorer shows this plus one. */
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
const RX_COMPUTE = /exceeded CUs meter|Computational budget exceeded/;
const RX_LAMPORTS = /insufficient lamports/i;
const RX_ERROR_LINE = /error/i;
const RX_SLIPPAGE = /slippage|AmountOutBelowMinimum|MinimumAmountOut|MinAmountOut|TooLittle\w*Received|TooMuch\w*Required|BelowMinTokensOut/i;

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

/** Log lines of the failing program's own frame: from its last invoke up to its failure. */
function failingFrame(logs: string[], failedIdx: number, programId: string): string[] {
  let start = failedIdx;
  while (start > 0 && !logs[start - 1].startsWith(`Program ${programId} invoke [`)) start--;
  return logs.slice(Math.max(0, start - 1), failedIdx + 1);
}

export function diagnose(meta: RawTxMeta): Diagnosis {
  const logs = (meta.logMessages ?? []).filter((l): l is string => typeof l === "string");
  const { index, inner } = instructionError(meta.err);
  // The innermost program fails first; callers then re-report the same code, so the first "failed" line is the origin.
  const failedIdx = logs.findIndex((l) => RX_FAILED.test(l));
  const failedLine = failedIdx >= 0 ? logs[failedIdx] : undefined;
  const programId = failedLine?.match(RX_FAILED)?.[1];
  const program = programId ? KNOWN_PROGRAMS[programId] : undefined;
  const frame = programId ? failingFrame(logs, failedIdx, programId) : [];
  const anchorLine = frame.find((l) => RX_ANCHOR.test(l));
  const anchor = anchorLine?.match(RX_ANCHOR);
  const hexCode = failedLine?.match(RX_CUSTOM)?.[1];
  const code = customCode(inner) ?? (hexCode ? parseInt(hexCode, 16) : undefined) ?? (anchor ? Number(anchor[2]) : undefined);
  const known = code !== undefined ? program?.errors[code] : undefined;
  const builtin = typeof inner === "string" ? inner : undefined;

  const base = {
    instructionIndex: index,
    programId,
    programName: program?.name,
    errorCode: code,
    errorName: known?.name ?? anchor?.[1] ?? builtin,
    feeLamports: meta.fee,
    computeUnits: meta.computeUnitsConsumed ?? null,
  };
  const result = (cause: Cause, evidence: string): Diagnosis => ({ cause, ...CAUSE_INFO[cause], evidence, ...base });
  const errText = JSON.stringify(meta.err);
  const proof = anchorLine ?? failedLine ?? errText;

  const computeLine = logs.find((l) => RX_COMPUTE.test(l));
  if (builtin === "ComputationalBudgetExceeded" || computeLine) {
    return result("compute_budget_exceeded", computeLine ?? errText);
  }

  if (errText.includes("InsufficientFundsForFee") || errText.includes("InsufficientFundsForRent")) {
    return result("insufficient_lamports", errText);
  }
  const lamportsLine = logs.find((l) => RX_LAMPORTS.test(l));
  if (lamportsLine) return result("insufficient_lamports", lamportsLine);

  if (builtin && BUILTIN_CAUSES[builtin]) return result(BUILTIN_CAUSES[builtin], failedLine ?? errText);

  if (known) return result(known.cause, proof);

  const slippageLine = frame.find((l) => RX_ERROR_LINE.test(l) && RX_SLIPPAGE.test(l));
  if (slippageLine) return result("slippage_exceeded", slippageLine);

  if (anchor) {
    const cause = anchorCause(Number(anchor[2]));
    if (cause) return result(cause, anchorLine!);
  }
  if (code !== undefined) return result("program_custom_error", proof);

  return result("unknown", failedLine ?? errText);
}
