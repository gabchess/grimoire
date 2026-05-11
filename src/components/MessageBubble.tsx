"use client";

import GroundedAnswer from "./GroundedAnswer";
import { Message } from "@/data/marinade-demo";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-xs lg:max-w-md xl:max-w-lg rounded-2xl rounded-tr-sm bg-slate-700 px-4 py-3 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-xl lg:max-w-2xl rounded-2xl rounded-tl-sm bg-slate-800 border border-slate-700 px-4 py-3">
        <GroundedAnswer
          text={message.content}
          citations={message.citations ?? []}
        />
      </div>
    </div>
  );
}
