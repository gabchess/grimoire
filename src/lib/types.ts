/** Shared types for Grimoire chat UI */

export interface GlossaryChip {
  term: string;
  category: string;
}

export interface Attestation {
  txSignature: string;
  pda: string;
  explorerUrl: string;
}
