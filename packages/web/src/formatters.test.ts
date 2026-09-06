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
        propertyPath: "./src/my properties.ts",
        seed: 42,
        runs: 100
      })
    ).toBe(
      "npm run studio -- run --module './src/my target.ts' --export 'subjectUnderTest' --properties './src/my properties.ts' --seed 42 --runs 100"
    );
  });

  it("escapes single quotes for shell safety", () => {
    expect(quoteShell("it's-live")).toBe("'it'\\''s-live'");
  });
});

it("keeps a relocated replay command aligned with the structured request", async () => {
  const { readFileSync } = await import("node:fs");
  const { parseReportJson } = await import("./reportIO");
  const { buildReplayCommand } = await import("./formatters");
  const report = parseReportJson(readFileSync(new URL("../../../reports/chunk-buggy-chunk-preserves-values.json", import.meta.url), "utf8"));
  const command = buildReplayCommand({ ...report.cases[0]!, requestedRuns: 350 }, { modulePath: "./new/target.ts", propertyPath: "./new/property.ts" });
  expect(command).toContain("--module './new/target.ts'");
  expect(command).toContain("--properties './new/property.ts'");
  expect(command).toContain("--runs 350");
  expect(command).toContain("--case 'chunk-preserves-values'");
  expect(command).toContain("--path '0:0:0'");
  expect(command).not.toContain("./packages/examples/");
});
