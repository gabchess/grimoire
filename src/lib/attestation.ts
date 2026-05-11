/**
 * Oblivion Attestation Client
 * Server-side only — reads keypair from filesystem, sends TX to devnet.
 * Do NOT import from client components.
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";

// IDL import
import IDL_JSON from "@/lib/idl/oblivion_attestation.json";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm"
);
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const KEYPAIR_PATH = "/Users/gava/.config/solana/id.json";
// IMPORTANT: SEED_PREFIX must match the deployed program's seed bytes.
// The Anchor program at B6NwW2diNY6cADxYwYsci7jRAKjDsYhG7ne6XgXPzXHm was
// deployed with seed `b"grimoire-att"` (project codename pre-rebrand).
// Renaming this string changes PDA derivation and breaks every attestation.
// The user-facing brand is Oblivion; the on-chain seed bytes are immutable.
const SEED_PREFIX = Buffer.from("grimoire-att");

/** Load the server-side signing keypair.
 *
 * Production (Vercel): reads JSON array from SOLANA_KEYPAIR_JSON env var.
 * Local dev: falls back to KEYPAIR_PATH file (Solana CLI default location).
 *
 * Vercel serverless has no access to the developer's home directory, so the
 * keypair must round-trip through an env var. Format: the raw JSON array the
 * `solana-keygen new` command writes (e.g. "[204,100,21,249,...]" — 64 bytes).
 */
function loadKeypair(): Keypair {
  const envJson = process.env.SOLANA_KEYPAIR_JSON;
  if (envJson) {
    const secretKey = Uint8Array.from(JSON.parse(envJson));
    return Keypair.fromSecretKey(secretKey);
  }
  const raw = readFileSync(KEYPAIR_PATH, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}

export interface AttestationInput {
  clientOrgId: string; // UUID string e.g. "00000000-0000-0000-0000-000000000001"
  sourceDocContent: string; // raw content to hash as source doc
  query: string; // user query to hash
  response: string; // full agent response to hash
  sourceUrl: string; // source URL (truncated to 64 bytes)
}

export interface AttestationResult {
  txSignature: string;
  pda: string;
  explorerUrl: string;
}

/** Parse a UUID string into a 16-byte Uint8Array */
function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error(`Invalid UUID: ${uuid}`);
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** SHA-256 a string, return 32-byte Buffer */
function sha256(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

/** Pad / truncate a string to exactly N bytes, UTF-8 encoded */
function toFixedBytes(input: string, len: number): Uint8Array {
  const encoded = Buffer.from(input, "utf8");
  const out = Buffer.alloc(len, 0);
  encoded.copy(out, 0, 0, Math.min(encoded.length, len));
  return new Uint8Array(out);
}

export async function createAttestation(
  input: AttestationInput
): Promise<AttestationResult> {
  const { clientOrgId, sourceDocContent, query, response, sourceUrl } = input;

  // Derive hash arrays
  const clientOrgIdBytes = uuidToBytes(clientOrgId);
  const sourceDocHash = sha256(sourceDocContent);
  const queryHash = sha256(query);
  const responseHash = sha256(response);
  const sourceUrlShort = toFixedBytes(sourceUrl, 64);

  // Derive PDA
  const [pda] = PublicKey.findProgramAddressSync(
    [SEED_PREFIX, clientOrgIdBytes, sourceDocHash, queryHash],
    PROGRAM_ID
  );

  // Load keypair + provider
  const keypair = loadKeypair();
  const connection = new Connection(RPC_URL, "confirmed");

  // Inline wallet object implementing the @coral-xyz/anchor Wallet interface.
  // The exported `Wallet` class is CJS-only and not available in the ESM bundle
  // that Next.js 15 App Router uses, so we construct an equivalent inline.
  const wallet = {
    publicKey: keypair.publicKey,
    payer: keypair,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T
    ): Promise<T> => {
      if (tx instanceof VersionedTransaction) {
        tx.sign([keypair]);
      } else {
        (tx as Transaction).partialSign(keypair);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> => {
      for (const tx of txs) {
        if (tx instanceof VersionedTransaction) {
          tx.sign([keypair]);
        } else {
          (tx as Transaction).partialSign(keypair);
        }
      }
      return txs;
    },
  };

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    skipPreflight: false,
  });

  const program = new Program(IDL_JSON as Idl, provider);

  // Send the transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txSignature = await (program.methods as any)
    .createAttestation(
      Array.from(clientOrgIdBytes),
      Array.from(sourceDocHash),
      Array.from(queryHash),
      Array.from(responseHash),
      Array.from(sourceUrlShort)
    )
    .accounts({
      attestation: pda,
      signer: keypair.publicKey,
    })
    .rpc();

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet-alpha";
  const explorerUrl = `https://solana.fm/tx/${txSignature}?cluster=${cluster}`;

  return {
    txSignature,
    pda: pda.toBase58(),
    explorerUrl,
  };
}
