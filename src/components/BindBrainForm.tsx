"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BindBrainForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const governanceUrl = url.trim();
    if (!governanceUrl || status === "loading") return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governanceUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Redirect to the DAO chat page on success
      router.push(`/dao/${data.daoSlug}`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to bind brain. Try again."
      );
    }
  };

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-3 max-w-xl"
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status === "loading"}
          placeholder="Paste your Realms governance URL (e.g., realms.today/dao/marinade)"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!url.trim() || status === "loading"}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-500 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "loading" ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Indexing...
            </span>
          ) : (
            "Bind brain"
          )}
        </button>
      </form>

      {status === "error" && (
        <p className="mt-2 text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
