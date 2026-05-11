"use client";

import { useState } from "react";
import CitationCard from "./CitationCard";
import { Citation } from "@/data/marinade-demo";

interface GroundedAnswerProps {
  text: string;
  citations: Citation[];
}

interface CitationMarkerProps {
  index: number;
  title: string;
  onClick: () => void;
}

function CitationMarker({ index, title, onClick }: CitationMarkerProps) {
  return (
    <button
      type="button"
      role="doc-noteref"
      aria-label={`Citation ${index}: ${title}`}
      aria-describedby={`citation-${index}`}
      onClick={onClick}
      className="inline-flex items-center justify-center align-baseline mx-0.5 rounded transition-all duration-[200ms] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-1 hover:scale-110 cursor-pointer"
      style={{
        height: "18px",
        width: "18px",
        backgroundColor: "rgba(153, 69, 255, 0.2)",
        color: "#9945FF",
        fontSize: "0.6875rem",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        verticalAlign: "baseline",
        borderRadius: "4px",
      }}
      title={title}
    >
      {index}
    </button>
  );
}

function renderTextWithCitations(
  text: string,
  citations: Citation[],
  onMarkerClick: (idx: number) => void
) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const citIdx = parseInt(match[1], 10) - 1;
      if (citIdx >= 0 && citIdx < citations.length) {
        return (
          <CitationMarker
            key={i}
            index={citIdx + 1}
            title={citations[citIdx].title}
            onClick={() => onMarkerClick(citIdx)}
          />
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export default function GroundedAnswer({ text, citations }: GroundedAnswerProps) {
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);

  const handleMarkerClick = (idx: number) => {
    setHighlightedIdx(idx);
    const el = document.getElementById(`citation-${idx + 1}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    // Clear highlight after animation
    setTimeout(() => setHighlightedIdx(null), 1000);
  };

  if (!text) {
    return (
      <p className="text-[0.8125rem] text-status-error">
        Failed to get a response.
      </p>
    );
  }

  return (
    <div>
      <p className="text-[0.8125rem] text-text-primary leading-[1.5]">
        {renderTextWithCitations(text, citations, handleMarkerClick)}
      </p>

      {citations.length > 0 && (
        <section
          role="doc-endnotes"
          aria-label="Source citations"
          className="mt-4"
        >
          <p className="mb-2 text-[0.6875rem] font-medium text-text-tertiary uppercase tracking-[0.05em]">
            Sources
          </p>
          <div className="flex flex-col gap-2">
            {citations.map((citation, i) => (
              <div
                key={citation.proposalId}
                style={{
                  transition: "box-shadow 0.4s ease-in-out",
                  boxShadow:
                    highlightedIdx === i
                      ? "0 0 0 2px #9945FF"
                      : "none",
                  borderRadius: "12px",
                }}
              >
                <CitationCard citation={citation} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
