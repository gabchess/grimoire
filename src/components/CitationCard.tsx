"use client";

import AttestationPill from "./AttestationPill";
import { Citation } from "@/data/marinade-demo";

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export default function CitationCard({ citation, index }: CitationCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-900 text-indigo-300 font-semibold text-xs">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-200">{citation.title}</span>
            <span className="text-slate-500 font-mono">{citation.proposalId}</span>
          </div>
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-indigo-400 hover:text-indigo-300 truncate transition-colors"
          >
            {citation.sourceUrl}
          </a>
          <div className="mt-2">
            <AttestationPill
              txHash={citation.attestation.txHash}
              explorerUrl={citation.attestation.explorerUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
