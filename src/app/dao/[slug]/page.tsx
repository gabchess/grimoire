import { MARINADE_DEMO_MESSAGES } from "@/data/marinade-demo";
import ChatInterface from "@/components/ChatInterface";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DAOPage({ params }: PageProps) {
  const { slug } = await params;
  const daoName = slug.toUpperCase();

  // For the demo, only marinade has pre-indexed data
  const messages = slug === "marinade" ? MARINADE_DEMO_MESSAGES : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-white">{daoName} DAO</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Powered by Oblivion: citation-grounded, onchain-verified.
          </p>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-6">
        <ChatInterface initialMessages={messages} daoSlug={slug} />
      </div>
    </div>
  );
}
