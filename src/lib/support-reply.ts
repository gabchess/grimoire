import type { DiagnoseResponse } from "./types";

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function formatSol(lamports: number): string {
  return `${(lamports / LAMPORTS_PER_SOL).toLocaleString("en-US", { maximumFractionDigits: 9 })} SOL`;
}

/** A short support-desk answer built from the diagnosis by template. No model. */
export function supportReply(r: DiagnoseResponse): string {
  const d = r.diagnosis;
  const where: string[] = [];
  if (d.instructionIndex !== undefined) where.push(`instruction #${d.instructionIndex + 1}`);
  if (d.programName ?? d.programId) where.push(`the ${d.programName ?? d.programId} program`);
  const code = d.errorCode !== undefined ? ` with error ${d.errorName ? `${d.errorName} ` : ""}(code ${d.errorCode})` : "";
  const lines = [
    `Hi, I looked at your transaction ${r.signature.slice(0, 8)}...${r.signature.slice(-8)}.`,
    `It failed because of this: ${d.title}.`,
  ];
  if (where.length > 0) lines.push(`The failure happened in ${where.join(" of ")}${code}.`);
  lines.push(`The line in the logs that shows it: ${d.evidence}`);
  lines.push(`What to do next: ${d.fix}`);
  lines.push(`The network still charged a fee of ${formatSol(d.feeLamports)} for the failed attempt.`);
  lines.push(`Details: ${r.explorerUrl}`);
  return lines.join("\n");
}
