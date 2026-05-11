"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface AttestationPillProps {
  txHash: string;
  explorerUrl: string;
}

function isPending(txHash: string): boolean {
  return !txHash || txHash.startsWith("placeholder");
}

function truncateHash(hash: string, chars: number): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export default function AttestationPill({
  txHash,
  explorerUrl,
}: AttestationPillProps) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = isPending(txHash);

  const displayHash = hovered
    ? truncateHash(txHash, 6)
    : truncateHash(txHash, 4);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    navigator.clipboard.writeText(txHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (pending) {
    return (
      <span
        aria-label="Attestation pending"
        className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-overlay px-3 py-1"
      >
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-tertiary" />
        <span className="text-[0.8125rem] font-medium text-text-tertiary">
          Pending attestation
        </span>
        <span className="font-mono text-[0.6875rem] text-text-disabled">
          ---
        </span>
      </span>
    );
  }

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Transaction verified on Solana. Hash: ${txHash}. Click to view on Solana Explorer.`}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-all duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent-green focus-visible:outline-offset-2 group"
      style={{
        backgroundColor: hovered ? "#14F19526" : "#14F19512",
        borderColor: hovered ? "rgba(20, 241, 149, 0.3)" : "#14F19526",
        boxShadow: hovered ? "0 0 24px rgba(20, 241, 149, 0.12)" : "none",
        cursor: "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pulse dot */}
      <span
        className="animate-attest-pulse flex-shrink-0 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: "#14F195" }}
        aria-hidden="true"
      />

      {/* Label */}
      <span className="text-[0.8125rem] font-medium" style={{ color: "#14F195" }}>
        Verified on Solana
      </span>

      {/* Truncated hash */}
      <span
        className="font-mono text-[0.6875rem] transition-all duration-[200ms]"
        style={{ color: "rgba(20, 241, 149, 0.6)" }}
        title={txHash}
      >
        {displayHash}
      </span>

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy transaction hash"
        className="flex-shrink-0 transition-opacity duration-[120ms] lg:opacity-0 lg:group-hover:opacity-100 opacity-100 focus-visible:opacity-100"
        style={{ color: copied ? "#14F195" : "rgba(20, 241, 149, 0.4)" }}
      >
        {copied ? (
          <Check size={14} />
        ) : (
          <Copy size={14} />
        )}
      </button>

      {/* Copied tooltip */}
      {copied && (
        <span
          role="status"
          aria-live="polite"
          className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-lg border border-border-subtle bg-overlay px-2 py-1 text-[0.6875rem] text-accent-green shadow-md pointer-events-none"
        >
          Copied!
        </span>
      )}
    </a>
  );
}
