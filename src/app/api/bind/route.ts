/**
 * POST /api/bind
 *
 * Placeholder DAO brain binding endpoint.
 * Real DAO ingestion is offline / out of scope for MVP.
 * Returns success after a short delay so the UI flow works end-to-end.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { governanceUrl } = body as { governanceUrl?: string };

  if (!governanceUrl) {
    return NextResponse.json(
      { error: "governanceUrl is required" },
      { status: 400 }
    );
  }

  // Simulate indexing delay
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // For MVP: always succeed and route to marinade demo
  return NextResponse.json({
    status: "success",
    daoSlug: "marinade",
    message:
      "Brain bound. Redirecting to Marinade DAO demo (pre-indexed governance data).",
  });
}
