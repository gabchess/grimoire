"use client";

import { useState } from "react";
import AttestationPill from "./AttestationPill";
import {
  Vote,
  BookOpen,
  X as XIcon,
  Link2,
  GitBranch,
  FileText,
} from "lucide-react";
import type { Citation } from "./GroundedAnswer";

interface CitationCardProps {
  citation: Citation;
  index: number;
}

type SourceType =
  | "governance_proposal"
  | "glossary"
  | "x_post"
  | "onchain_tx"
  | "github"
  | "docs"
  | "unknown";

interface SourceTypeConfig {
  icon: React.ElementType;
  color: string;
  label: string;
}

const SOURCE_TYPE_CONFIG: Record<SourceType, SourceTypeConfig> = {
  governance_proposal: { icon: Vote, color: "#9945FF", label: "Governance" },
  glossary: { icon: BookOpen, color: "#64B5F6", label: "Glossary" },
  x_post: { icon: XIcon, color: "#1DA1F2", label: "X post" },
  onchain_tx: { icon: Link2, color: "#14F195", label: "Onchain TX" },
  github: { icon: GitBranch, color: "#E6EDF3", label: "GitHub" },
  docs: { icon: FileText, color: "#FFB800", label: "Docs" },
  unknown: { icon: Link2, color: "#64647A", label: "Source" },
};

function detectSourceType(url: string): SourceType {
  if (url.includes("realms.today") || url.includes("snapshot.org"))
    return "governance_proposal";
  if (url.includes("github.com")) return "github";
  if (url.includes("x.com") || url.includes("twitter.com")) return "x_post";
  if (url.includes("solana.fm") || url.includes("explorer.solana.com"))
    return "onchain_tx";
  return "docs";
}

export default function CitationCard({ citation, index }: CitationCardProps) {
  const [hovered, setHovered] = useState(false);
  const type = detectSourceType(citation.sourceUrl);
  const config = SOURCE_TYPE_CONFIG[type] ?? SOURCE_TYPE_CONFIG.unknown;
  const Icon = config.icon;

  const borderColor = hovered
    ? config.color + "4D"
    : "var(--color-border-subtle)";

  const bgColor = hovered ? config.color + "08" : "var(--color-elevated)";

  return (
    <article
      id={`citation-${index + 1}`}
      aria-label={`Source ${index + 1}: ${citation.title}`}
      className="relative rounded-xl p-3 transition-all duration-[120ms] cursor-default"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Index badge */}
      <span
        className="absolute -top-1.5 -left-1.5 inline-flex h-5 w-5 items-center justify-center rounded font-mono text-[0.6875rem] font-semibold"
        style={{
          backgroundColor: "rgba(153, 69, 255, 0.25)",
          color: "#9945FF",
          borderRadius: "4px",
        }}
        aria-hidden="true"
      >
        {index + 1}
      </span>

      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          aria-hidden="true"
          style={{
            backgroundColor: config.color + "1F",
            borderRadius: "8px",
          }}
        >
          <Icon size={16} style={{ color: config.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[0.8125rem] font-medium text-text-primary leading-none">
              {citation.title}
            </span>
            <span className="font-mono text-[0.6875rem] text-text-tertiary">
              {citation.proposalId}
            </span>
          </div>

          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open source: ${citation.title}`}
            className="mt-1.5 block text-[0.8125rem] truncate transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-1"
            style={{ color: "#9945FF" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#B06AFF")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9945FF")}
          >
            {citation.sourceUrl}
          </a>

          <div className="mt-2 relative">
            <AttestationPill
              txHash={citation.attestation.txHash}
              explorerUrl={citation.attestation.explorerUrl}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
