import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vitest";

const SRC = join(__dirname, "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(name) ? [path] : [];
  });
}

const clientFiles = sourceFiles(SRC).filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));

test("the page has client components to check", () => {
  expect(clientFiles.length).toBeGreaterThan(0);
});

test.each(clientFiles.map((f) => [relative(SRC, f), f]))("%s keeps the Helius key on the server", (_name, file) => {
  const text = readFileSync(file, "utf8");
  expect(text).not.toMatch(/from\s+["'](@\/lib\/helius|(\.\.?\/)+(lib\/)?helius)["']/);
  expect(text).not.toContain("HELIUS_API_KEY");
});
