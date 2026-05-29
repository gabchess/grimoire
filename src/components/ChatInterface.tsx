"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble, { type Message } from "./MessageBubble";
import type { Citation } from "./GroundedAnswer";
import {
  Globe,
  Send,
} from "lucide-react";

interface ChatInterfaceProps {
  initialMessages?: Message[];
}

export default function ChatInterface({
  initialMessages = [],
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
        body: JSON.stringify({ query }),
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
              const citations: Citation[] = [];
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
    <div className="flex flex-col flex-1 overflow-hidden bg-void">
      {/* Message area */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto px-6 py-4"
      >
        <div className="max-w-[768px] mx-auto w-full">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <Globe size={32} className="text-text-tertiary mb-3" />
              <p className="text-[1.125rem] font-semibold text-text-secondary">
                Ask anything about Solana
              </p>
              <p className="mt-2 text-[0.8125rem] text-text-tertiary">
                Every answer is anchored onchain as a Solana attestation.
              </p>
            </div>
          )}

          <div role="list" className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>

          {isLoading && (
            <div
              aria-live="polite"
              aria-label="Grimoire is responding"
              className="flex items-center gap-2 px-1 mt-4"
            >
              <span className="text-[0.6875rem] text-text-tertiary">
                Grimoire is thinking
              </span>
              <span className="inline-flex gap-0.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1 w-1 rounded-full animate-bounce"
                    style={{
                      backgroundColor: "#9945FF",
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
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
            placeholder="Ask anything about Solana..."
            aria-label="Your Solana question"
            className="flex-1 h-11 rounded-xl border border-border-subtle bg-input px-4 text-[0.8125rem] text-text-primary placeholder:text-text-tertiary transition-all duration-[120ms] focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-[#9945FF26] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-xl transition-all duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[0.97]"
            style={{ backgroundColor: "#9945FF" }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled)
                e.currentTarget.style.backgroundColor = "#B06AFF";
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
  );
}
