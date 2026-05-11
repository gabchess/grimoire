import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MARINADE_DEMO_MESSAGES } from "@/data/marinade-demo";
import ChatInterface from "@/components/ChatInterface";
import { LogoLockup } from "@/components/Logo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DAOPage({ params }: PageProps) {
  const { slug } = await params;
  const daoName = slug.toUpperCase();

  // For the demo, only marinade has pre-indexed data
  const messages = slug === "marinade" ? MARINADE_DEMO_MESSAGES : [];

  return (
    <div className="h-screen bg-void text-text-primary flex flex-col overflow-hidden">
      {/* Header bar */}
      <header
        className="flex-shrink-0 flex items-center gap-4 border-b border-border-subtle px-6"
        style={{
          height: "56px",
          backgroundColor: "var(--color-elevated)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <Link
          href="/"
          aria-label="Back to home"
          className="flex items-center justify-center h-8 w-8 rounded-lg text-text-tertiary hover:text-text-primary transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-accent-purple focus-visible:outline-offset-2"
        >
          <ArrowLeft size={18} />
        </Link>

        <LogoLockup />

        <h1 className="text-[1.25rem] font-semibold tracking-[-0.01em] text-text-primary">
          {daoName}
        </h1>
      </header>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 overflow-hidden">
        <ChatInterface initialMessages={messages} daoSlug={slug} />
      </div>
    </div>
  );
}
