"use client";

import GroundedAnswer from "./GroundedAnswer";
import { LogoMark } from "./Logo";
import { Message } from "@/data/marinade-demo";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div
        role="listitem"
        aria-label="Your message"
        className="flex justify-end"
      >
        <div
          className="max-w-[480px] px-4 py-3 text-[0.8125rem] text-text-primary leading-[1.6]"
          style={{
            backgroundColor: "var(--color-overlay)",
            borderRadius: "12px 12px 4px 12px",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const hasError =
    message.content.startsWith("Error:") ||
    message.content.startsWith("Failed to get");

  return (
    <div
      role="listitem"
      aria-label="Oblivion's response"
      className="flex justify-start"
    >
      <div
        className="max-w-[800px] w-full p-4 transition-colors duration-[120ms]"
        style={{
          backgroundColor: "var(--color-surface)",
          border: hasError
            ? "1px solid rgba(242, 92, 84, 0.3)"
            : "1px solid var(--color-border-subtle)",
          borderRadius: "12px 12px 12px 4px",
        }}
      >
        {/* Agent label */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="inline-flex h-5 w-5 items-center justify-center rounded"
            style={{
              backgroundColor: "rgba(153, 69, 255, 0.2)",
              borderRadius: "4px",
            }}
          >
            <LogoMark size={12} aria-hidden="true" />
          </div>
          <span className="text-[0.6875rem] tracking-[0.02em] text-text-tertiary">
            Oblivion
          </span>
        </div>

        <GroundedAnswer
          text={message.content}
          citations={message.citations ?? []}
        />
      </div>
    </div>
  );
}
