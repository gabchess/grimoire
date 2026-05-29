/**
 * tx-decode.ts — Grimoire deterministic transaction failure decoder.
 *
 * Takes the result of connection.getTransaction(...) and extracts structured
 * failure information without any LLM involvement. The LLM explains what this
 * module detects; it does not do the detection itself.
 *
 * All pattern matching is against real Solana/Anchor log formats produced by
 * the runtime. No guessing, no inference — only explicit text pattern matching.
 */

// ─── Anchor framework error table ──────────────────────────────────────────
// Source: https://github.com/coral-xyz/anchor/blob/master/lang/src/error.rs
// Anchor error codes 100–199 are language-level; 1000–5999 are framework-level;
// 6000+ are program-defined custom errors.
const ANCHOR_ERROR_TABLE: Record<number, { name: string; meaning: string }> = {
  // Instruction errors
  100: { name: "InstructionMissing", meaning: "8 byte instruction discriminator was not provided" },
  101: { name: "InstructionFallbackNotFound", meaning: "Fallback functions are not supported" },
  102: { name: "InstructionDidNotDeserialize", meaning: "The program could not deserialize the given instruction" },
  103: { name: "InstructionDidNotSerialize", meaning: "The program could not serialize the given instruction" },

  // IDL errors
  1000: { name: "IdlInstructionStub", meaning: "The program was compiled without IDL instructions" },

  // Constraint errors (2000–2999)
  2000: { name: "ConstraintMut", meaning: "A mut constraint was violated — account must be marked mutable" },
  2001: { name: "ConstraintHasOne", meaning: "A has_one constraint was violated — field ownership mismatch" },
  2002: { name: "ConstraintSigner", meaning: "A signer constraint was violated — account must sign the transaction" },
  2003: { name: "ConstraintRaw", meaning: "A raw constraint was violated — custom constraint expression failed" },
  2004: { name: "ConstraintOwner", meaning: "An owner constraint was violated — account is owned by the wrong program" },
  2005: { name: "ConstraintRentExempt", meaning: "A rent exemption constraint was violated" },
  2006: { name: "ConstraintSeeds", meaning: "A seeds constraint was violated — PDA derivation does not match expected address" },
  2007: { name: "ConstraintExecutable", meaning: "An executable constraint was violated — account must be a program" },
  2008: { name: "ConstraintState", meaning: "Deprecated constraint — do not use" },
  2009: { name: "ConstraintAssociated", meaning: "An associated constraint was violated" },
  2010: { name: "ConstraintAssociatedInit", meaning: "An associated init constraint was violated" },
  2011: { name: "ConstraintClose", meaning: "A close constraint was violated" },
  2012: { name: "ConstraintAddress", meaning: "An address constraint was violated — account address does not match expected" },
  2013: { name: "ConstraintZero", meaning: "Expected zero account discriminant" },
  2014: { name: "ConstraintTokenMint", meaning: "A token mint constraint was violated" },
  2015: { name: "ConstraintTokenOwner", meaning: "A token owner constraint was violated" },
  2016: { name: "ConstraintMintMintAuthority", meaning: "Mint authority constraint was violated" },
  2017: { name: "ConstraintMintFreezeAuthority", meaning: "Freeze authority constraint was violated" },
  2018: { name: "ConstraintMintDecimals", meaning: "Mint decimals constraint was violated" },
  2019: { name: "ConstraintSpace", meaning: "A space constraint was violated — wrong account allocation size" },
  2020: { name: "ConstraintAccountIsNone", meaning: "Required account was None but a value was expected" },

  // Account errors (3000–3999)
  3000: { name: "AccountDiscriminatorAlreadySet", meaning: "Account discriminator was already set on this account" },
  3001: { name: "AccountDiscriminatorNotFound", meaning: "Account discriminator not found — is this a new account?" },
  3002: { name: "AccountDiscriminatorMismatch", meaning: "Account discriminator mismatch — wrong account type passed" },
  3003: { name: "AccountDidNotDeserialize", meaning: "Failed to deserialize account data" },
  3004: { name: "AccountDidNotSerialize", meaning: "Failed to serialize account data" },
  3005: { name: "AccountNotEnoughKeys", meaning: "Not enough account keys were provided" },
  3006: { name: "AccountNotMutable", meaning: "The given account is not mutable" },
  3007: { name: "AccountOwnedByWrongProgram", meaning: "Account is owned by a different program than expected" },
  3008: { name: "InvalidProgramId", meaning: "Program ID does not match expected" },
  3009: { name: "InvalidProgramExecutable", meaning: "Program is not executable" },
  3010: { name: "AccountNotSigner", meaning: "Account did not sign the transaction" },
  3011: { name: "AccountNotSystemOwned", meaning: "Account is not owned by the system program" },
  3012: { name: "AccountNotInitialized", meaning: "Account has not been initialized — the account discriminator is zero" },
  3013: { name: "AccountNotProgramData", meaning: "Account is not a program data account" },
  3014: { name: "AccountNotAssociatedTokenAccount", meaning: "Account is not an associated token account" },
  3015: { name: "AccountSysvarMismatch", meaning: "Account is not the correct sysvar" },
  3016: { name: "AccountReallocExceedsLimit", meaning: "Account reallocation exceeded the maximum 10240 bytes" },
  3017: { name: "AccountDuplicateReallocs", meaning: "Account was reallocated more than once in a single instruction" },
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DetectedPattern {
  pattern: string;
  explanation: string;
  suggestedFix: string;
}

export interface AnchorError {
  /** Snake_case error code name, e.g. "ConstraintMut" */
  code: string;
  /** Numeric error code, e.g. 2000 */
  number: number;
  /** Human-readable message from the log or the error table */
  message: string;
  /** Account that caused the error, if present in logs */
  causingAccount?: string;
}

export interface DecodeResult {
  /** Whether the transaction failed */
  failed: boolean;
  /** Transaction fee in lamports */
  fee: number;
  /** Compute units consumed */
  computeUnitsConsumed: number | null;
  /** Program ID of the first failing program, if detectable */
  failingProgram?: string;
  /** Raw err field from TransactionMeta, as a string */
  rawError?: string;
  /** Parsed Anchor framework error, if detected */
  anchorError?: AnchorError;
  /** Custom error code (decimal) extracted from logs, if present */
  customErrorCode?: number;
  /** Detected failure patterns with explanations and fix suggestions */
  detectedPatterns: DetectedPattern[];
  /** All program log messages from the transaction */
  logMessages: string[];
}

// ─── Lightweight shim for the TransactionMeta subset we care about ──────────
// We only reference what we actually use so that the decoder has no hard
// dependency on @solana/web3.js types. The real objects will always have these
// fields; callers from the API route pass the full ParsedTransactionWithMeta.

interface TxMeta {
  err: unknown;
  fee: number;
  computeUnitsConsumed?: number | null;
  logMessages?: string[] | null;
  innerInstructions?: unknown[] | null;
}

interface TxMessage {
  accountKeys?: Array<{ pubkey: { toBase58(): string } } | { pubkey: string }>;
}

interface TxData {
  transaction: {
    message: TxMessage;
  };
}

// ─── Log pattern regexes ────────────────────────────────────────────────────

// "Program <id> failed: custom program error: 0x<hex>"
const RX_PROGRAM_FAILED =
  /Program (\S+) failed: (.+)/i;

// "AnchorError ... Error Code: <Name>. Error Number: <N>. Error Message: <msg>."
const RX_ANCHOR_ERROR_FULL =
  /AnchorError[^.]*Error Code: (\w+)\. Error Number: (\d+)\. Error Message: ([^.]+(?:\.[^.]+)*?)\./;

// "AnchorError caused by account: <account>."
const RX_ANCHOR_CAUSED_BY =
  /AnchorError caused by account: (\S+)\./;

// "custom program error: 0x<hex>"
const RX_CUSTOM_HEX =
  /custom program error: 0x([0-9a-fA-F]+)/i;

// "Program log: AnchorError ..."  (alternate log format)
const RX_PROGRAM_LOG_ANCHOR =
  /Program log: AnchorError/i;

// Compute budget exceeded
const RX_COMPUTE_EXCEEDED =
  /(?:exceeded CUs|Computational budget exceeded|compute budget exceeded|exceeded max units)/i;

// "consumed N of M compute units" — used to detect near-limit usage
const RX_COMPUTE_CONSUMED =
  /consumed (\d+) of (\d+) compute units/i;

// Insufficient lamports / rent
const RX_INSUFFICIENT_LAMPORTS =
  /insufficient lamports/i;

const RX_INSUFFICIENT_RENT =
  /insufficient funds for rent/i;

// Account already in use (re-init / PDA collision)
const RX_ALREADY_IN_USE =
  /already in use/i;

// Blockhash not found
const RX_BLOCKHASH_NOT_FOUND =
  /blockhash not found/i;

// ─── Helpers ────────────────────────────────────────────────────────────────

function errToString(err: unknown): string {
  if (err === null || err === undefined) return "";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Attempt to locate the first failing program from the "Program X failed: ..."
 * log line.
 */
function extractFailingProgram(logs: string[]): string | undefined {
  for (const line of logs) {
    const m = line.match(RX_PROGRAM_FAILED);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Parse Anchor error information from log messages.
 * Anchor emits structured error logs in two variants:
 *   1. Inline: "AnchorError ... Error Code: X. Error Number: N. Error Message: M."
 *   2. Via "Program log: AnchorError ..."
 */
function extractAnchorError(
  logs: string[],
  errString: string
): AnchorError | undefined {
  // Combine all lines for matching across line boundaries (Anchor sometimes
  // splits the error across consecutive log lines)
  const combined = logs.join(" ");

  const fullMatch = combined.match(RX_ANCHOR_ERROR_FULL);
  if (!fullMatch) {
    // Try to detect by custom hex code alone and map against our table
    const hexMatch = (combined + " " + errString).match(RX_CUSTOM_HEX);
    if (hexMatch) {
      const code = parseInt(hexMatch[1], 16);
      const entry = ANCHOR_ERROR_TABLE[code];
      if (entry) {
        return {
          code: entry.name,
          number: code,
          message: entry.meaning,
        };
      }
    }
    return undefined;
  }

  const codeName = fullMatch[1];
  const codeNumber = parseInt(fullMatch[2], 10);
  const message = fullMatch[3].trim();

  const causingMatch = combined.match(RX_ANCHOR_CAUSED_BY);

  return {
    code: codeName,
    number: codeNumber,
    message,
    causingAccount: causingMatch ? causingMatch[1] : undefined,
  };
}

/**
 * Extract custom program error code (decimal) from logs when it is NOT an
 * Anchor framework error (i.e., code >= 6000 or not in the Anchor table).
 */
function extractCustomErrorCode(
  logs: string[],
  errString: string
): number | undefined {
  const combined = logs.join(" ") + " " + errString;
  const m = combined.match(RX_CUSTOM_HEX);
  if (!m) return undefined;
  const decimal = parseInt(m[1], 16);
  // If it's in the Anchor framework table, it is NOT a custom program error
  if (ANCHOR_ERROR_TABLE[decimal]) return undefined;
  return decimal;
}

// ─── Pattern detection ──────────────────────────────────────────────────────

function detectPatterns(
  logs: string[],
  errString: string,
  anchorError?: AnchorError
): DetectedPattern[] {
  const combined = logs.join("\n") + "\n" + errString;
  const patterns: DetectedPattern[] = [];

  // --- Anchor error — emit a specific pattern for the detected error ---
  if (anchorError) {
    const entry = ANCHOR_ERROR_TABLE[anchorError.number];
    const accountPart = anchorError.causingAccount
      ? ` (account: ${anchorError.causingAccount})`
      : "";

    if (anchorError.number >= 2000 && anchorError.number < 3000) {
      // Constraint errors
      patterns.push({
        pattern: `Anchor constraint violation: ${anchorError.code}${accountPart}`,
        explanation: entry
          ? entry.meaning
          : anchorError.message,
        suggestedFix: constraintFix(anchorError.code, anchorError.causingAccount),
      });
    } else if (anchorError.number >= 3000 && anchorError.number < 4000) {
      // Account errors
      patterns.push({
        pattern: `Anchor account error: ${anchorError.code}${accountPart}`,
        explanation: entry
          ? entry.meaning
          : anchorError.message,
        suggestedFix: accountFix(anchorError.code, anchorError.causingAccount),
      });
    } else {
      patterns.push({
        pattern: `Anchor error: ${anchorError.code} (${anchorError.number})${accountPart}`,
        explanation: anchorError.message,
        suggestedFix:
          "Check the Anchor error documentation for this specific error code and review the account constraints in your program instruction handler.",
      });
    }
  }

  // --- Compute budget exceeded ---
  if (RX_COMPUTE_EXCEEDED.test(combined)) {
    patterns.push({
      pattern: "Compute budget exceeded",
      explanation:
        "The transaction consumed more compute units than the current compute unit limit allows. Each transaction gets 200,000 CU by default; complex programs can exceed this.",
      suggestedFix:
        "Add a ComputeBudgetProgram.setComputeUnitLimit instruction at the start of your transaction with a higher limit (e.g., 400_000 or 1_400_000). Use 'solana program show --programs' or simulation to profile actual CU usage first.",
    });
  } else {
    // Near-limit warning even if not exceeded
    const consumedMatch = combined.match(RX_COMPUTE_CONSUMED);
    if (consumedMatch) {
      const used = parseInt(consumedMatch[1], 10);
      const limit = parseInt(consumedMatch[2], 10);
      if (limit > 0 && used / limit >= 0.9) {
        patterns.push({
          pattern: `High compute unit usage: ${used.toLocaleString()} / ${limit.toLocaleString()} CU (${Math.round((used / limit) * 100)}%)`,
          explanation:
            "The transaction used more than 90% of its compute budget. This is not failing now but is a reliability risk — any slight increase in complexity will fail.",
          suggestedFix:
            "Add ComputeBudgetProgram.setComputeUnitLimit to reserve headroom. Consider profiling your program with 'solana program simulate' to identify expensive operations.",
        });
      }
    }
  }

  // --- Insufficient lamports / rent ---
  if (RX_INSUFFICIENT_LAMPORTS.test(combined)) {
    patterns.push({
      pattern: "Insufficient lamports",
      explanation:
        "The payer or a referenced account does not have enough SOL to cover the transaction fee, account rent, or the minimum rent-exempt balance.",
      suggestedFix:
        "Ensure the paying wallet has enough SOL. If initializing a new account, pre-fund it with the rent-exempt minimum using SystemProgram.transfer before calling your instruction.",
    });
  }

  if (RX_INSUFFICIENT_RENT.test(combined)) {
    patterns.push({
      pattern: "Insufficient funds for rent",
      explanation:
        "An account does not have enough SOL to maintain the minimum rent-exempt balance for its allocated data size.",
      suggestedFix:
        "Calculate the required lamports with 'connection.getMinimumBalanceForRentExemption(dataSize)' and ensure the account is funded above that threshold.",
    });
  }

  // --- Account already in use (PDA collision / re-init) ---
  if (RX_ALREADY_IN_USE.test(combined)) {
    patterns.push({
      pattern: "Account already in use",
      explanation:
        "You are attempting to create or initialize an account at an address that already exists. This typically indicates a PDA collision or an attempt to re-initialize an already-initialized account.",
      suggestedFix:
        "Check if the account is already initialized before calling the init instruction. If using PDAs, verify your seed derivation is unique per user or entity. Add a check like `require!(!account.is_initialized, ErrorCode::AlreadyInitialized)` in your program.",
    });
  }

  // --- Blockhash not found ---
  if (RX_BLOCKHASH_NOT_FOUND.test(combined)) {
    patterns.push({
      pattern: "Blockhash not found",
      explanation:
        "The recent blockhash included in the transaction has expired. Solana blockhashes are valid for approximately 150 slots (~60 seconds). The transaction was not confirmed in time.",
      suggestedFix:
        "Fetch a fresh blockhash immediately before signing and sending the transaction. Use 'connection.getLatestBlockhash()' and set 'lastValidBlockHeight' on the transaction for proper expiry handling.",
    });
  }

  // --- Custom program error (not Anchor framework) ---
  const customCode = extractCustomErrorCode(logs, errString);
  if (customCode !== undefined && customCode >= 6000 && !anchorError) {
    patterns.push({
      pattern: `Custom program error: ${customCode} (0x${customCode.toString(16).toUpperCase()})`,
      explanation:
        `This is a program-defined custom error (codes >= 6000 are program-specific). The program author defines these in their IDL under the 'errors' array. Code ${customCode} maps to a specific named error in that program.`,
      suggestedFix:
        "Look up the error in the program's IDL file or source code. In Anchor programs, errors are defined with #[error_code] enum. Find the entry at index " +
        (customCode - 6000) +
        " (0-indexed) to get the name and message.",
    });
  }

  // --- Failing program (generic, if no other pattern matched) ---
  const programFailed = combined.match(RX_PROGRAM_FAILED);
  if (programFailed && patterns.length === 0) {
    patterns.push({
      pattern: `Program failed: ${programFailed[1]}`,
      explanation: `The program at ${programFailed[1]} returned an error: "${programFailed[2].trim()}". This is a runtime-level failure from the Solana VM.`,
      suggestedFix:
        "Check the full log output above for more context. Simulate the transaction with 'connection.simulateTransaction' to get detailed logs before sending.",
    });
  }

  return patterns;
}

/** Return a human fix suggestion for an Anchor constraint error code. */
function constraintFix(code: string, account?: string): string {
  const acct = account ? ` on account '${account}'` : "";
  switch (code) {
    case "ConstraintMut":
      return `Mark the account${acct} as mutable in your instruction: add 'mut' to the account constraint (#[account(mut, ...]]).`;
    case "ConstraintHasOne":
      return `The has_one relationship${acct} failed. Verify the field value on the account matches the corresponding account key in the accounts struct.`;
    case "ConstraintSigner":
      return `Account${acct} must sign the transaction. Ensure the correct wallet signs, or remove the signer constraint if it is not required.`;
    case "ConstraintSeeds":
      return `PDA seeds do not produce the expected address${acct}. Double-check that the seeds and program_id used on the client match exactly what the program derives with find_program_address.`;
    case "ConstraintAddress":
      return `The account address${acct} does not match the hard-coded expected address. Verify you are passing the correct account.`;
    case "ConstraintRaw":
      return `A custom constraint expression failed${acct}. Review the #[account(constraint = ...)] expression in your program and ensure the condition is met.`;
    default:
      return `Review the ${code} constraint on account${acct} in your program's accounts struct and ensure all requirements are satisfied.`;
  }
}

/** Return a human fix suggestion for an Anchor account error code. */
function accountFix(code: string, account?: string): string {
  const acct = account ? ` ('${account}')` : "";
  switch (code) {
    case "AccountNotInitialized":
      return `Account${acct} has not been initialized yet. Call the initialization instruction first, or verify you are passing the correct account address.`;
    case "AccountOwnedByWrongProgram":
      return `Account${acct} is owned by a different program. Ensure you are passing an account that was created by this program, not a system account or a different program's account.`;
    case "AccountDiscriminatorMismatch":
      return `Wrong account type passed${acct}. The account discriminator does not match the expected account struct. Verify you are passing the right account for this instruction.`;
    case "AccountNotMutable":
      return `Account${acct} must be mutable. Add the 'mut' modifier to the account in your transaction.`;
    case "AccountNotSigner":
      return `Account${acct} must sign the transaction. Add it as a signer when building the transaction.`;
    default:
      return `Review the ${code} error for account${acct}. Check that the correct account is being passed and it meets all program requirements.`;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Decode a Solana transaction's failure (or success) into structured data.
 *
 * @param meta  - The TransactionMeta from getTransaction (meta field)
 * @param txData - The transaction data (transaction field) — used for program ID extraction
 */
export function decodeTransactionFailure(
  meta: TxMeta,
  // txData is optional; we accept it for future use but do not require it
  _txData?: TxData
): DecodeResult {
  const logs: string[] = (meta.logMessages ?? []).filter(
    (l): l is string => typeof l === "string"
  );
  const errString = errToString(meta.err);
  const failed = meta.err !== null && meta.err !== undefined;

  const anchorError = failed ? extractAnchorError(logs, errString) : undefined;
  const failingProgram = failed ? extractFailingProgram(logs) : undefined;

  // Custom error code only when no Anchor error was mapped
  const customErrorCode =
    failed && !anchorError
      ? extractCustomErrorCode(logs, errString)
      : undefined;

  const detectedPatterns = failed
    ? detectPatterns(logs, errString, anchorError)
    : [];

  return {
    failed,
    fee: meta.fee,
    computeUnitsConsumed: meta.computeUnitsConsumed ?? null,
    failingProgram,
    rawError: failed ? errString : undefined,
    anchorError,
    customErrorCode,
    detectedPatterns,
    logMessages: logs,
  };
}
