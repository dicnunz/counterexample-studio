import { describe, expect, it } from "vitest";
import { buildBundledRerunCommand, buildLocalPreviewCommand, quoteShell } from "./formatters";

describe("formatters", () => {
  it("quotes bundled rerun example ids safely", () => {
    expect(buildBundledRerunCommand("binary-search-buggy", 104729, 120)).toBe(
      "npm run studio -- run --example 'binary-search-buggy' --seed 104729 --runs 120"
    );
  });

  it("builds a stable local preview command", () => {
    expect(
      buildLocalPreviewCommand({
        modulePath: "./src/my target.ts",
        exportName: "subjectUnderTest",
        propertyPath: "./src/my property.ts",
        seed: 42,
        runs: 100
      })
    ).toBe(
      "npm run studio -- run --module './src/my target.ts' --export 'subjectUnderTest' --property './src/my property.ts' --seed 42 --runs 100"
    );
  });

  it("escapes single quotes for shell safety", () => {
    expect(quoteShell("it's-live")).toBe("'it'\\''s-live'");
  });
});
