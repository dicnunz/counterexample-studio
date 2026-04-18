import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { renderMarkdownReport } from "./markdown.js";
import { loadPropertySuite } from "./loader.js";
import { runLoadedPropertySuite, runPropertySuiteFromFiles, toJsonReport } from "./run.js";

const createdDirectories: string[] = [];
const coreDefinitionsPath = fileURLToPath(new URL("./definitions.ts", import.meta.url));

describe("core runner", () => {
  afterEach(async () => {
    while (createdDirectories.length > 0) {
      const directory = createdDirectories.pop();
      if (directory) {
        await rm(directory, { force: true, recursive: true });
      }
    }
  });

  it("runs a failing property, captures shrink details, and renders reports", async () => {
    const workspace = await createFixtureWorkspace();
    const report = await runPropertySuiteFromFiles(path.join(workspace, "suite.ts"), {
      propertyIds: ["must-stay-negative"],
      seed: 123
    });

    expect(report.summary.failed).toBe(1);
    expect(report.summary.total).toBe(1);

    const property = report.properties[0];
    expect(property.status).toBe("failed");
    expect(property.counterexamplePath).toMatch(/^\d(?::\d+)*$/);
    expect(property.failureSequence.length).toBeGreaterThan(0);
    expect(property.searchTrace.length).toBeGreaterThan(0);
    expect(property.shrinkPath.length).toBeGreaterThan(0);
    expect(property.finalCase?.args.summary).toBe("[0]");
    expect(property.finalCase?.actual?.summary).toBe("0");
    expect(property.rerunCommand).toContain("--seed 123");
    expect(property.rerunCommand).toContain("--property 'must-stay-negative'");
    expect(property.reproductionSnippet).toContain('runLoadedPropertySuite');

    const markdown = renderMarkdownReport(report);
    expect(markdown).toContain("Minimal Counterexample");
    expect(markdown).toContain("Shrink Path");

    const parsed = JSON.parse(toJsonReport(report)) as { properties: Array<{ id: string }> };
    expect(parsed.properties[0]?.id).toBe("must-stay-negative");
  });

  it("loads suites with relative target modules and respects property selection", async () => {
    const workspace = await createFixtureWorkspace();
    const suite = await loadPropertySuite(path.join(workspace, "suite.ts"));

    const report = await runLoadedPropertySuite(suite, {
      propertyIds: ["absolute-value-is-nonnegative"],
      seed: 77
    });

    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(0);
    expect(report.properties).toHaveLength(1);
    expect(report.properties[0]?.id).toBe("absolute-value-is-nonnegative");
    expect(report.properties[0]?.status).toBe("passed");
  });

  it("writes a report JSON that remains readable for downstream tooling", async () => {
    const workspace = await createFixtureWorkspace();
    const report = await runPropertySuiteFromFiles(path.join(workspace, "suite.ts"), {
      propertyIds: ["must-stay-negative"],
      seed: 999
    });

    const reportPath = path.join(workspace, "report.json");
    await writeFile(reportPath, toJsonReport(report), "utf8");

    const saved = await readFile(reportPath, "utf8");
    expect(saved).toContain('"schemaVersion": "1"');
    expect(saved).toContain('"must-stay-negative"');
  });
});

async function createFixtureWorkspace(): Promise<string> {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "counterexample-core-"));
  createdDirectories.push(workspace);

  const subjectPath = path.join(workspace, "subject.ts");
  const suitePath = path.join(workspace, "suite.ts");

  await writeFile(
    subjectPath,
    [
      "export function identity(value: number): number {",
      "  return value;",
      "}",
      "",
      "export function absoluteValue(value: number): number {",
      "  return Math.abs(value);",
      "}"
    ].join("\n"),
    "utf8"
  );

  await writeFile(
    suitePath,
    [
      `import { defineProperty, definePropertySuite, failInvariant, integer, tuple } from ${JSON.stringify(coreDefinitionsPath)};`,
      "",
      "export default definePropertySuite({",
      '  id: "fixture-suite",',
      '  title: "Fixture Suite",',
      '  targetModule: "./subject.ts",',
      "  properties: [",
      "    defineProperty({",
      '      id: "must-stay-negative",',
      '      title: "Identity stays negative",',
      '      target: "identity",',
      '      invariant: "identity(value) should stay below zero",',
      "      cases: tuple(integer()),",
      "      check: ({ actual }) => (typeof actual === 'number' && actual < 0 ? true : failInvariant({ expected: 'number < 0', actual, expectedLabel: 'invariant' }))",
      "    }),",
      "    defineProperty({",
      '      id: "absolute-value-is-nonnegative",',
      '      title: "Absolute value is never negative",',
      '      target: "absoluteValue",',
      '      invariant: "absoluteValue(value) should be >= 0",',
      "      cases: tuple(integer()),",
      "      check: ({ actual }) => typeof actual === 'number' && actual >= 0",
      "    })",
      "  ]",
      "});"
    ].join("\n"),
    "utf8"
  );

  return workspace;
}
