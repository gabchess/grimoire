import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The route reads recorded fixtures with fs at request time, so ship them with it.
  outputFileTracingIncludes: {
    "/api/diagnose": ["./test/fixtures/tx/*.json"],
  },
};

export default nextConfig;
