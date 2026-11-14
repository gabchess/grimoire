import { describe, expect, test } from "vitest";
import { diagnose } from "@/lib/diagnose";

const P = "Prog1111111111111111111111111111111111111111";
const meta = (err: unknown, logs: string[]) => ({ err, fee: 5000, logMessages: logs });
const frame = (inner: string[], failed: string) => [`Program ${P} invoke [1]`, ...inner, `Program ${P} failed: ${failed}`];

describe("rules that keep false positives out", () => {
  test("a non-Anchor program returning 3012 is its own error, not AccountNotInitialized", () => {
    const d = diagnose(meta({ InstructionError: [0, { Custom: 3012 }] }, frame([], "custom program error: 0xbc4")));
    expect(d.cause).toBe("program_custom_error");
  });

  test("a non-Anchor program returning 2006 is not an Anchor constraint failure", () => {
    const d = diagnose(meta({ InstructionError: [0, { Custom: 2006 }] }, frame([], "custom program error: 0x7d6")));
    expect(d.cause).toBe("program_custom_error");
  });

  test("a program that logs its slippage setting and then fails for another reason is not slippage", () => {
    const logs = frame(["Program log: slippage_bps=50"], "custom program error: 0x1770");
    expect(diagnose(meta({ InstructionError: [0, { Custom: 6000 }] }, logs)).cause).toBe("program_custom_error");
  });

  test("a slippage error logged by an earlier, successful program does not count", () => {
    const logs = [
      "Program Other111111111111111111111111111111111111 invoke [1]",
      "Program log: Error: slippage check skipped",
      "Program Other111111111111111111111111111111111111 success",
      ...frame([], "custom program error: 0x1770"),
    ];
    expect(diagnose(meta({ InstructionError: [1, { Custom: 6000 }] }, logs)).cause).toBe("program_custom_error");
  });
});

test("compute or lamport messages from an earlier, successful program do not set the cause", () => {
  const logs = [
    "Program Other111111111111111111111111111111111111 invoke [1]",
    "Program log: insufficient lamports, retrying with a smaller amount",
    "Program log: exceeded CUs meter in a dry run",
    "Program Other111111111111111111111111111111111111 success",
    ...frame([], "custom program error: 0x1770"),
  ];
  expect(diagnose(meta({ InstructionError: [1, { Custom: 6000 }] }, logs)).cause).toBe("program_custom_error");
});

describe("builtin and framework errors", () => {
  test("builtin InsufficientFunds means not enough SOL", () => {
    const d = diagnose(meta({ InstructionError: [2, "InsufficientFunds"] }, frame([], "insufficient funds for instruction")));
    expect(d).toMatchObject({ cause: "insufficient_lamports", errorName: "InsufficientFunds", instructionIndex: 2 });
  });

  test("builtin IllegalOwner means the wrong account was passed", () => {
    expect(diagnose(meta({ InstructionError: [0, "IllegalOwner"] }, frame([], "Provided owner is not allowed"))).cause).toBe(
      "wrong_account_passed",
    );
  });

  test("a non-Anchor slippage error from the failing program is slippage", () => {
    const logs = frame(["Program log: Error: exceeds desired slippage limit"], "custom program error: 0x1e");
    expect(diagnose(meta({ InstructionError: [0, { Custom: 30 }] }, logs)).cause).toBe("slippage_exceeded");
  });

  test("Anchor 101 means the client sent an instruction this program does not accept", () => {
    const logs = frame(
      ["Program log: AnchorError occurred. Error Code: InstructionFallbackNotFound. Error Number: 101. Error Message: x."],
      "custom program error: 0x65",
    );
    expect(diagnose(meta({ InstructionError: [0, { Custom: 101 }] }, logs)).cause).toBe("instruction_rejected");
  });

  test("a transaction-level fee shortfall is not enough SOL", () => {
    expect(diagnose(meta("InsufficientFundsForFee", [])).cause).toBe("insufficient_lamports");
  });
});
