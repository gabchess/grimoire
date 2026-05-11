"use client";

import { useState } from "react";

interface AttestationPillProps {
  txHash: string;
  explorerUrl: string;
}

export default function AttestationPill({
  txHash,
  explorerUrl,
}: AttestationPillProps) {
  const [showFull, setShowFull] = useState(false);

  const shortHash =
    txHash.length > 8
      ? `${txHash.slice(0, 4)}...${txHash.slice(-4)}`
      : txHash;

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/50 border border-emerald-800 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 transition-colors"
      onMouseEnter={() => setShowFull(true)}
      onMouseLeave={() => setShowFull(false)}
      title={`Full TX: ${txHash}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
      <span>Verified on Solana</span>
      <span className="font-mono opacity-75">
        {showFull ? txHash.slice(0, 12) + "..." : shortHash}
      </span>
    </a>
  );
}
