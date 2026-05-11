"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import { Message, Citation } from "@/data/marinade-demo";

interface ChatInterfaceProps {
  initialMessages: Message[];
  daoSlug: string;
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

    // Add user message
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: query,
    };

    // Add placeholder agent message for streaming
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
                (c: { proposalId: string; title: string; sourceUrl: string }, idx: number) => ({
                  proposalId: c.proposalId,
                  title: c.title,
                  sourceUrl: c.sourceUrl,
                  attestation: {
                    txHash: event.attestation?.txSignature || `placeholder-${idx}`,
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
            // Malformed SSE line — skip
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
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-slate-400 text-sm">
              No demo data for this DAO yet.
            </p>
            <p className="text-slate-500 text-xs mt-1">
              Try{" "}
              <a
                href="/dao/marinade"
                className="underline text-indigo-400 hover:text-indigo-300"
              >
                /dao/marinade
              </a>{" "}
              for a pre-indexed demo.
            </p>
          </div>
        </div>
      )}

      {/* Message list */}
      {messages.length > 0 && (
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {/* Demo notice — only shown when using pre-loaded demo data */}
          {initialMessages.length > 0 && messages.length === initialMessages.length && (
            <div className="text-center py-2">
              <span className="text-xs text-slate-500 bg-slate-800 rounded-full px-3 py-1">
                Pre-indexed demo: {daoSlug} DAO governance
              </span>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 px-4">
              <span className="text-xs text-slate-500">Oblivion is thinking</span>
              <span className="inline-flex gap-0.5">
                <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-800 pt-4 mt-auto flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={`Ask anything about ${daoSlug} governance...`}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "..." : "Ask"}
          </button>
        </form>
      </div>
    </div>
  );
}
