// Static demo data for Marinade DAO governance Q&A
// Used by /dao/marinade pre-indexed demo.
// TODO Round 1B: replace with live RAG responses from Supabase knowledge_graph.

export interface Attestation {
  txHash: string;
  explorerUrl: string;
}

export interface Citation {
  proposalId: string;
  title: string;
  sourceUrl: string;
  attestation: Attestation;
}

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  citations?: Citation[];
}

export const MARINADE_DEMO_MESSAGES: Message[] = [
  // --- Q&A 1: Validator delegation ---
  {
    id: "msg-1",
    role: "user",
    content: "What's Marinade's policy on validator delegation?",
  },
  {
    id: "msg-2",
    role: "agent",
    content:
      "Marinade's validator delegation strategy is governed by JIP-7 [1], which established the core framework: delegation is spread across 100+ validators using a performance-based scoring system that weighs uptime, commission, and geographic distribution. JIP-11 [2] extended this by introducing the Stake Pool's automated rebalancing mechanism, which adjusts delegation every epoch based on performance deltas rather than waiting for manual governance votes. The most recent update came via JIP-22 [3], which added a 10% cap on any single validator to limit concentration risk after a top-5 validator cluster went offline for 18 hours in Q3 2024.",
    citations: [
      {
        proposalId: "JIP-7",
        title: "Validator Delegation Strategy",
        sourceUrl: "https://realms.today/dao/marinade/proposal/JIP-7",
        attestation: {
          txHash:
            "5K3pBuQRmNvJXaFhZ2yLkDwMoEsP4cY8tGnHiVjXbRqA9uWdFg3rNsELpYoKmT6",
          explorerUrl:
            "https://solana.fm/tx/5K3pBuQRmNvJXaFhZ2yLkDwMoEsP4cY8tGnHiVjXbRqA9uWdFg3rNsELpYoKmT6",
        },
      },
      {
        proposalId: "JIP-11",
        title: "Stake Pool Rebalancing Automation",
        sourceUrl: "https://realms.today/dao/marinade/proposal/JIP-11",
        attestation: {
          txHash:
            "3mRtUwXoLpZ8fGvHkNqAsBcDjEiY7gMnPrTuVwZaQxFe2sKhCyBdJ4nLmWoIvRp",
          explorerUrl:
            "https://solana.fm/tx/3mRtUwXoLpZ8fGvHkNqAsBcDjEiY7gMnPrTuVwZaQxFe2sKhCyBdJ4nLmWoIvRp",
        },
      },
      {
        proposalId: "JIP-22",
        title: "Single-Validator Concentration Cap (10%)",
        sourceUrl: "https://realms.today/dao/marinade/proposal/JIP-22",
        attestation: {
          txHash:
            "7zPkAqWxSdBtYnMhRcGfJiLoEuVpNrHkOsTmCuZwXbQj5yDeFgLnIaKvEpWoMsJt",
          explorerUrl:
            "https://solana.fm/tx/7zPkAqWxSdBtYnMhRcGfJiLoEuVpNrHkOsTmCuZwXbQj5yDeFgLnIaKvEpWoMsJt",
        },
      },
    ],
  },

  // --- Q&A 2: Emergency unbond conditions ---
  {
    id: "msg-3",
    role: "user",
    content: "Under what conditions can stakers trigger an emergency unbond?",
  },
  {
    id: "msg-4",
    role: "agent",
    content:
      "Emergency unbonds in Marinade are governed by a two-tier framework established in JIP-19 [1]. Tier 1 (immediate, no governance vote required): triggered automatically when a validator's uptime drops below 80% over a 3-epoch window or when the validator's commission is raised above the DAO-approved ceiling of 8% without prior notice. Tier 2 (governance-gated): used when the core team suspects validator misconduct that doesn't meet the automated thresholds, such as MEV front-running patterns or geographic clustering that increases systemic risk. JIP-19 specified that Tier 2 requires a 72-hour voting window with a 60% quorum. The DAO has exercised Tier 2 once, in the Q4 2024 incident documented in JIP-24 [2], where three validators suspected of coordinated MEV extraction were removed after a 75% affirmative vote.",
    citations: [
      {
        proposalId: "JIP-19",
        title: "Emergency Unbond Conditions and Tier Framework",
        sourceUrl: "https://realms.today/dao/marinade/proposal/JIP-19",
        attestation: {
          txHash:
            "9aNbCpDqErFsGtHuIvJwKxLyMzNaObPcQdReSfTgUhViWjXkYlZmAnBoCpDqErFs",
          explorerUrl:
            "https://solana.fm/tx/9aNbCpDqErFsGtHuIvJwKxLyMzNaObPcQdReSfTgUhViWjXkYlZmAnBoCpDqErFs",
        },
      },
      {
        proposalId: "JIP-24",
        title: "Q4 2024 MEV Extraction Incident: Validator Removal",
        sourceUrl: "https://realms.today/dao/marinade/proposal/JIP-24",
        attestation: {
          txHash:
            "2fGhIjKlMnOpQrStUvWxYzAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUu",
          explorerUrl:
            "https://solana.fm/tx/2fGhIjKlMnOpQrStUvWxYzAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUu",
        },
      },
    ],
  },

  // --- Q&A 3: Treasury management ---
  {
    id: "msg-5",
    role: "user",
    content: "How does Marinade manage its treasury reserves?",
  },
  {
    id: "msg-6",
    role: "agent",
    content:
      "Marinade's treasury policy is defined in JIP-15 [1], which established a three-bucket allocation: 60% in stablecoins (USDC on Solana), 30% in liquid SOL, and 10% reserved for protocol-owned liquidity on decentralized exchanges. JIP-15 requires a quarterly rebalancing vote if any bucket drifts more than 15% from its target. The DAO approved a one-time deviation in JIP-20 [2], allowing the liquid SOL bucket to temporarily rise to 45% during the validator expansion phase in mid-2024, with a hard revert deadline that was met in October 2024. Current treasury runway at the approved burn rate (estimated $42K/month for core team + infrastructure) is approximately 28 months as of the last quarterly report submitted under JIP-15's disclosure requirement.",
    citations: [
      {
        proposalId: "JIP-15",
        title: "Treasury Reserve Allocation and Rebalancing Policy",
        sourceUrl: "https://realms.today/dao/marinade/proposal/JIP-15",
        attestation: {
          txHash:
            "4hJkLmNoPqRsTuVwXyZaAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsSiTtUuVv",
          explorerUrl:
            "https://solana.fm/tx/4hJkLmNoPqRsTuVwXyZaAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsSiTtUuVv",
        },
      },
      {
        proposalId: "JIP-20",
        title: "Temporary SOL Bucket Increase for Validator Expansion",
        sourceUrl: "https://realms.today/dao/marinade/proposal/JIP-20",
        attestation: {
          txHash:
            "6iKlMnOpQrStUvWxYzAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWw",
          explorerUrl:
            "https://solana.fm/tx/6iKlMnOpQrStUvWxYzAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWw",
        },
      },
    ],
  },
];
