"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import { Message, Citation } from "@/data/marinade-demo";
import {
  Vote,
  BookOpen,
  X as XIcon,
  Link2,
  GitBranch,
  FileText,
  Clock,
  Database,
  Globe,
  Send,
} from "lucide-react";

interface ChatInterfaceProps {
  initialMessages: Message[];
  daoSlug: string;
}

interface SidebarProps {
  daoSlug: string;
}

function Sidebar({ daoSlug }: SidebarProps) {
  const daoName = daoSlug.toUpperCase();

  // Static demo metadata; dynamic data fetch comes in a later round
  const sourceBreakdown = [
    { label: "Governance", count: 47, icon: Vote, color: "#9945FF" },
    { label: "X posts", count: 124, icon: XIcon, color: "#1DA1F2" },
    { label: "GitHub", count: 12, icon: GitBranch, color: "#E6EDF3" },
    { label: "Glossary", count: 89, icon: BookOpen, color: "#64B5F6" },
    { label: "Docs", count: 23, icon: FileText, color: "#FFB800" },
  ];

  return (
    <aside
      role="complementary"
      aria-label="Brain information"
      className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-border-subtle bg-surface overflow-y-auto"
      style={{ padding: "24px" }}
    >
      {/* Brain info */}
      <div>
        <h2 className="text-[1.25rem] font-semibold tracking-[-0.01em] text-text-primary">
          {daoName}
        </h2>
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
            <Database size={14} className="text-text-tertiary flex-shrink-0" />
            <span>4 sources</span>
          </div>
          <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
            <Clock size={14} className="text-text-tertiary flex-shrink-0" />
            <span>Indexed 2 min ago</span>
          </div>
        </div>
      </div>

      <div className="my-4 h-px bg-border-subtle" />

      {/* Source breakdown */}
      <div>
        <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-text-tertiary">
          Source types
        </p>
        <div className="flex flex-col gap-2">
          {sourceBreakdown.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2">
                <Icon size={14} style={{ color: s.color }} aria-hidden="true" />
                <span className="flex-1 text-[0.8125rem] text-text-secondary">
                  {s.label}
                </span>
                <span className="text-[0.6875rem] text-text-tertiary">
                  {s.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="my-4 h-px bg-border-subtle" />

      {/* Attestation info */}
      <div>
        <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-text-tertiary">
          Attestations
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
            <span className="text-status-success font-medium">3</span>
            <span className="text-text-tertiary">written</span>
          </div>
          <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
            <Globe size={14} className="text-text-tertiary flex-shrink-0" />
            <span>devnet</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function ChatInterface({
  initialMessages,
  daoSlug,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;

    setInput("");
    setIsLoading(true);

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: query,
    };

    const agentMsgId = `msg-agent-${Date.now()}`;
    const agentMsg: Message = {
      id: agentMsgId,
      role: "agent",
      content: "",
      citations: [],
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, daoSlug }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "chunk") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, content: m.content + event.text }
                    : m
                )
              );
            } else if (event.type === "done") {
              const citations: Citation[] = (event.citations || []).map(
                (
                  c: { proposalId: string; title: string; sourceUrl: string },
                  idx: number
                ) => ({
                  proposalId: c.proposalId,
                  title: c.title,
                  sourceUrl: c.sourceUrl,
                  sourceType: "governance_proposal" as const,
                  attestation: {
                    txHash:
                      event.attestation?.txSignature || `placeholder-${idx}`,
                    explorerUrl: event.attestation?.explorerUrl || "",
                  },
                })
              );
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, citations } : m
                )
              );
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? {
                        ...m,
                        content:
                          m.content ||
                          `Error: ${event.message || "Unknown error"}`,
                      }
                    : m
                )
              );
            }
          } catch {
            // Malformed SSE line -- skip
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                content:
                  m.content ||
                  `Failed to get a response. ${err instanceof Error ? err.message : ""}`,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar (desktop only) */}
      <Sidebar daoSlug={daoSlug} />

      {/* Chat area */}
      <div className="flex flex-col flex-1 overflow-hidden bg-void">
        {/* Message area */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          <div className="max-w-[768px] mx-auto w-full">
            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <p className="text-[1.25rem] font-semibold text-text-secondary">
                  No brain bound yet
                </p>
                <p className="mt-2 text-[0.8125rem] text-text-tertiary">
                  Head back to the{" "}
                  <a
                    href="/"
                    className="text-accent-purple hover:text-accent-purple-hover transition-colors duration-[120ms]"
                  >
                    landing page
                  </a>{" "}
                  to bind sources.
                </p>
              </div>
            )}

            {/* Demo notice */}
            {initialMessages.length > 0 &&
              messages.length === initialMessages.length && (
                <div className="text-center mb-4">
                  <span
                    className="inline-block text-[0.6875rem] text-text-tertiary px-4 py-1"
                    style={{
                      backgroundColor: "var(--color-overlay)",
                      borderRadius: "9999px",
                    }}
                  >
                    Pre-indexed demo: Marinade governance
                  </span>
                </div>
              )}

            {/* Messages */}
            <div role="list" className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>

            {/* Loading indicator */}
            {isLoading && (
              <div
                aria-live="polite"
                aria-label="Agent is responding"
                className="flex items-center gap-2 px-1 mt-4"
              >
                <span className="text-[0.6875rem] text-text-tertiary">
                  Oblivion is thinking
                </span>
                <span className="inline-flex gap-0.5">
                  <span
                    className="h-1 w-1 rounded-full animate-bounce [animation-delay:0ms]"
                    style={{ backgroundColor: "#9945FF" }}
                  />
                  <span
                    className="h-1 w-1 rounded-full animate-bounce [animation-delay:150ms]"
                    style={{ backgroundColor: "#9945FF" }}
                  />
                  <span
                    className="h-1 w-1 rounded-full animate-bounce [animation-delay:300ms]"
                    style={{ backgroundColor: "#9945FF" }}
                  />
                </span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div
          className="flex-shrink-0 border-t border-border-subtle px-6 py-4"
          style={{ backgroundColor: "var(--color-elevated)" }}
        >
          <form
            onSubmit={handleSubmit}
            className="flex gap-3 max-w-[768px] mx-auto w-full"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder={`Ask anything about ${daoSlug}...`}
              aria-label={`Ask a question about ${daoSlug}`}
              className="flex-1 h-11 rounded-xl border border-border-subtle bg-input px-4 text-[0.8125rem] text-text-primary placeholder:text-text-tertiary transition-all duration-[120ms] focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[#9945FF26] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-xl transition-all duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[0.97]"
              style={{ backgroundColor: "#9945FF" }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = "#B06AFF";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#9945FF";
              }}
            >
              <Send size={18} color="white" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
