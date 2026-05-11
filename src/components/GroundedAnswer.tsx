"use client";

import CitationCard from "./CitationCard";
import { Citation } from "@/data/marinade-demo";

interface GroundedAnswerProps {
  text: string;
  citations: Citation[];
}

function renderTextWithCitations(text: string, citations: Citation[]) {
  // Replace [N] tokens with styled citation spans
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const citIndex = parseInt(match[1], 10) - 1;
      if (citIndex >= 0 && citIndex < citations.length) {
        return (
          <button
            key={i}
            className="inline-flex items-center justify-center h-4 w-4 rounded bg-indigo-800 text-indigo-300 text-xs font-semibold mx-0.5 hover:bg-indigo-700 transition-colors cursor-pointer align-middle"
            title={`${citations[citIndex].title} (${citations[citIndex].proposalId})`}
          >
            {citIndex + 1}
          </button>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export default function GroundedAnswer({ text, citations }: GroundedAnswerProps) {
  return (
    <div>
      <p className="text-slate-200 text-sm leading-relaxed">
        {renderTextWithCitations(text, citations)}
      </p>

      {citations.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
            Sources
          </p>
          {citations.map((citation, i) => (
            <CitationCard key={citation.proposalId} citation={citation} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
