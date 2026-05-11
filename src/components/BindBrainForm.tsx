"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X as XIcon, GitBranch, Vote, FileText, Link as LinkIcon } from "lucide-react";

interface SourceInput {
  type: "x" | "github" | "governance" | "docs" | "other";
  url: string;
  label: string;
  placeholder: string;
  icon: React.ElementType;
  color: string;
}

const BASE_SOURCES: Omit<SourceInput, "url">[] = [
  {
    type: "x",
    label: "X handle or profile URL",
    placeholder: "@handle or profile URL",
    icon: XIcon,
    color: "#1DA1F2",
  },
  {
    type: "github",
    label: "GitHub repository URL",
    placeholder: "github.com/org/repo",
    icon: GitBranch,
    color: "#E6EDF3",
  },
  {
    type: "governance",
    label: "Governance forum URL",
    placeholder: "Governance forum URL (Realms, Snapshot...)",
    icon: Vote,
    color: "#9945FF",
  },
  {
    type: "docs",
    label: "Docs, wiki, or any URL",
    placeholder: "Docs, wiki, or any URL",
    icon: FileText,
    color: "#FFB800",
  },
];

const PHASE_LABELS = [
  "Fetching sources...",
  "Building embeddings...",
  "Writing attestations...",
];

type FormStatus = "idle" | "loading" | "error";

export default function BindBrainForm() {
  const [sources, setSources] = useState<SourceInput[]>(
    BASE_SOURCES.map((s) => ({ ...s, url: "" }))
  );
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const router = useRouter();
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasAnyInput = sources.some((s) => s.url.trim().length > 0);

  const handleUrlChange = (idx: number, val: string) => {
    setSources((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, url: val } : s))
    );
  };

  const addSource = () => {
    if (sources.length >= 8) return;
    setSources((prev) => [
      ...prev,
      {
        type: "other",
        label: "Additional URL",
        placeholder: "Any URL",
        icon: LinkIcon,
        color: "#64647A",
        url: "",
      },
    ]);
  };

  const startProgressSimulation = () => {
    let p = 0;
    let phase = 0;
    progressRef.current = setInterval(() => {
      p += Math.random() * 4 + 1;
      if (p >= 90) {
        p = 90;
        clearInterval(progressRef.current!);
      }
      // Advance phase at 33% and 66%
      if (p >= 33 && phase === 0) {
        phase = 1;
        setPhaseIdx(1);
      }
      if (p >= 66 && phase === 1) {
        phase = 2;
        setPhaseIdx(2);
      }
      setProgress(p);
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAnyInput || status === "loading") return;

    setStatus("loading");
    setErrorMsg("");
    setProgress(0);
    setPhaseIdx(0);
    startProgressSimulation();

    const filledSources = sources
      .filter((s) => s.url.trim().length > 0)
      .map((s) => ({ type: s.type, url: s.url.trim() }));

    try {
      // TODO: update /api/bind/route.ts to accept new sources[] shape
      const res = await fetch("/api/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: filledSources }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Complete progress bar
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(100);
      setPhaseIdx(2);

      setTimeout(() => {
        router.push(`/dao/${data.daoSlug}`);
      }, 500);
    } catch (err) {
      if (progressRef.current) clearInterval(progressRef.current);
      setStatus("error");
      setProgress(0);
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to bind brain. Try again."
      );
    }
  };

  const isLoading = status === "loading";

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isLoading}
    >
      {/* Input group container */}
      <div
        className="rounded-2xl border border-border-subtle bg-surface p-6"
        style={{ borderRadius: "16px" }}
      >
        <div className="flex flex-col gap-3">
          {sources.map((source, idx) => {
            const Icon = source.icon;
            const filled = source.url.trim().length > 0;
            return (
              <div key={idx} className="flex items-center gap-3">
                {/* Visually hidden label for accessibility */}
                <label
                  htmlFor={`source-input-${idx}`}
                  className="sr-only"
                >
                  {source.label}
                </label>

                {/* Source type icon */}
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-[120ms]"
                  style={{
                    backgroundColor: filled
                      ? source.color + "40"
                      : source.color + "1F",
                  }}
                >
                  <Icon
                    size={18}
                    style={{ color: source.color }}
                    aria-hidden="true"
                  />
                </div>

                {/* Text input */}
                <div className="relative flex-1">
                  <input
                    id={`source-input-${idx}`}
                    type="text"
                    value={source.url}
                    onChange={(e) => handleUrlChange(idx, e.target.value)}
                    disabled={isLoading}
                    placeholder={source.placeholder}
                    className="w-full h-11 rounded-xl border border-border-subtle bg-input px-4 text-[0.8125rem] text-text-primary placeholder:text-text-tertiary transition-all duration-[120ms] focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[#9945FF26] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Optional label */}
                <span
                  className="flex-shrink-0 text-[0.6875rem] tracking-[0.02em] text-text-tertiary transition-opacity duration-[120ms]"
                  aria-hidden="true"
                  style={{ opacity: filled ? 0 : 1 }}
                >
                  optional
                </span>
              </div>
            );
          })}

          {sources.length < 8 && (
            <button
              type="button"
              onClick={addSource}
              disabled={isLoading}
              className="mt-1 text-left text-[0.8125rem] text-accent-purple hover:text-accent-purple-hover transition-colors duration-[120ms] disabled:opacity-40"
            >
              + Add another source
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isLoading && (
        <div className="mt-4">
          <div
            className="h-[3px] rounded-full bg-overlay overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Brain indexing progress"
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: progress >= 100
                  ? "#14F195"
                  : "linear-gradient(90deg, #9945FF, #14F195)",
              }}
            />
          </div>
          <p className="mt-2 text-[0.6875rem] text-text-tertiary">
            {PHASE_LABELS[phaseIdx]}
          </p>
        </div>
      )}

      {/* Error message */}
      {status === "error" && errorMsg && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-3 text-[0.8125rem] text-status-error"
        >
          {errorMsg}
        </p>
      )}

      {/* Submit button + caption */}
      <div className="mt-6">
        <button
          type="submit"
          disabled={!hasAnyInput || isLoading}
          className="w-full sm:w-auto rounded-xl bg-accent-purple px-8 py-4 text-sm font-medium text-white transition-all duration-[120ms] hover:bg-accent-purple-hover hover:shadow-[0_0_24px_rgba(153,69,255,0.3)] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent"
                style={{ animation: "spin 0.7s linear infinite" }}
              />
              Indexing...
            </span>
          ) : (
            "Build brain"
          )}
        </button>

        <p className="mt-3 text-[0.6875rem] text-text-tertiary leading-[1.4]">
          Takes 3-5 minutes. All sources hashed and attested onchain automatically.
        </p>
      </div>
    </form>
  );
}
