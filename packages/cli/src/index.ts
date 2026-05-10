#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { renderMarkdownReport } from "@counterexample-studio/core";
import { exampleCatalog, findExample } from "@counterexample-studio/examples";
import type { SuiteRunReport } from "@counterexample-studio/core";
import { reportHasFailures } from "./report-status.js";
import { runRuntimeWorker } from "./runtime-client.js";
import { startStudioServer } from "./server.js";
import { formatSupportRoute } from "./support-route.js";

type RunOptions = {
  readonly module: string | undefined;
  readonly property: string | undefined;
  readonly properties: string | undefined;
  readonly export: string | undefined;
  readonly case: string | undefined;
  readonly example: string | undefined;
  readonly seed: string | undefined;
  readonly runs: string | undefined;
  readonly path: string | undefined;
  readonly json: string | undefined;
  readonly markdown: string | undefined;
  readonly outDir: string | undefined;
  readonly port: string | undefined;
  readonly open: boolean | undefined;
};

function printHelp(): void {
  console.log(`Counterexample Studio

Usage:
  counterexample-studio run --module <file> --properties <file> [--export <name>] [--case <id>] [--seed <n>] [--runs <n>] [--path <counterexamplePath>]
  counterexample-studio report --module <file> --properties <file> [--out-dir <dir>]
  counterexample-studio example list
  counterexample-studio example run <example-id> [--seed <n>] [--runs <n>]
  counterexample-studio support
  counterexample-studio ui [--port <n>] [--open]
`);
}

function printSupport(): void {
  console.log(formatSupportRoute());
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a number, received "${value}"`);
  }
  return parsed;
}

function printRunSummary(report: SuiteRunReport): void {
  for (const caseReport of report.cases) {
    console.log(`${caseReport.status === "fail" ? "FAIL" : "PASS"}  ${caseReport.label}`);
    console.log(`Seed: ${caseReport.seed}`);
    console.log(`Rerun: ${caseReport.rerunCommand}`);
    console.log(`Invariant: ${caseReport.invariant}`);
    if (caseReport.status === "fail") {
      console.log(`Failing input: ${caseReport.failingInput?.preview ?? "n/a"}`);
      console.log(`Actual: ${caseReport.actual?.value.preview ?? "n/a"}`);
      console.log(`Shrink path: ${caseReport.counterexamplePath ?? "n/a"}`);
    }
    console.log("");
  }
}

async function writeReports(report: SuiteRunReport, options: Pick<RunOptions, "json" | "markdown" | "outDir">): Promise<void> {
  let jsonPath = options.json;
  let markdownPath = options.markdown;

  if (options.outDir) {
    const directory = resolve(options.outDir);
    await mkdir(directory, { recursive: true });
    const base = `${basename(report.modulePath).replace(/\.[^.]+$/, "")}-${report.cases[0]?.id ?? "report"}`;
    jsonPath ??= join(directory, `${base}.json`);
    markdownPath ??= join(directory, `${base}.md`);
  }

  if (jsonPath) {
    await writeFile(resolve(jsonPath), JSON.stringify(report, null, 2));
    console.log(`Wrote JSON report to ${resolve(jsonPath)}`);
  }

  if (markdownPath) {
    await writeFile(resolve(markdownPath), renderMarkdownReport(report));
    console.log(`Wrote Markdown report to ${resolve(markdownPath)}`);
  }
}

async function runWithOptions(values: RunOptions): Promise<SuiteRunReport> {
  if (values.example) {
    const example = findExample(values.example);
    return runRuntimeWorker({
      modulePath: example.modulePath,
      propertiesPath: example.propertiesPath,
      exportName: example.exportName,
      ...(values.case !== undefined ? { caseId: values.case } : {}),
      seed: parseNumber(values.seed) ?? example.defaultSeed,
      numRuns: parseNumber(values.runs) ?? example.defaultRuns,
      ...(values.path !== undefined ? { path: values.path } : {})
    });
  }

  const modulePath = values.module;
  const propertiesPath = values.properties ?? values.property;
  if (!modulePath || !propertiesPath) {
    throw new Error("`run` and `report` require either --example or both --module and --properties");
  }
  const parsedSeed = parseNumber(values.seed);
  const parsedRuns = parseNumber(values.runs);

  return runRuntimeWorker({
    modulePath,
    propertiesPath,
    ...(values.export !== undefined ? { exportName: values.export } : {}),
    ...(values.case !== undefined ? { caseId: values.case } : {}),
    ...(parsedSeed !== undefined ? { seed: parsedSeed } : {}),
    ...(parsedRuns !== undefined ? { numRuns: parsedRuns } : {}),
    ...(values.path !== undefined ? { path: values.path } : {})
  });
}

async function handleRun(args: readonly string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      module: { type: "string" },
      property: { type: "string" },
      properties: { type: "string" },
      export: { type: "string" },
      case: { type: "string" },
      example: { type: "string" },
      seed: { type: "string" },
      runs: { type: "string" },
      path: { type: "string" },
      json: { type: "string" },
      markdown: { type: "string" }
    }
  });

  const normalized = {
    module: values.module as string | undefined,
    property: values.property as string | undefined,
    properties: values.properties as string | undefined,
    export: values.export as string | undefined,
    case: values.case as string | undefined,
    example: values.example as string | undefined,
    seed: values.seed as string | undefined,
    runs: values.runs as string | undefined,
    path: values.path as string | undefined,
    json: values.json as string | undefined,
    markdown: values.markdown as string | undefined,
    outDir: undefined,
    port: undefined,
    open: undefined
  } satisfies RunOptions;
  const report = await runWithOptions(normalized);
  printRunSummary(report);
  await writeReports(report, normalized);

  if (reportHasFailures(report)) {
    process.exitCode = 1;
  }
}

async function handleReport(args: readonly string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      module: { type: "string" },
      property: { type: "string" },
      properties: { type: "string" },
      export: { type: "string" },
      case: { type: "string" },
      example: { type: "string" },
      seed: { type: "string" },
      runs: { type: "string" },
      path: { type: "string" },
      json: { type: "string" },
      markdown: { type: "string" },
      "out-dir": { type: "string" }
    }
  });

  const normalized = {
    module: values.module as string | undefined,
    property: values.property as string | undefined,
    properties: values.properties as string | undefined,
    export: values.export as string | undefined,
    case: values.case as string | undefined,
    example: values.example as string | undefined,
    seed: values.seed as string | undefined,
    runs: values.runs as string | undefined,
    path: values.path as string | undefined,
    json: values.json as string | undefined,
    markdown: values.markdown as string | undefined,
    outDir: values["out-dir"] as string | undefined,
    port: undefined,
    open: undefined
  } satisfies RunOptions;
  const report = await runWithOptions(normalized);
  await writeReports(report, normalized);
  printRunSummary(report);

  if (reportHasFailures(report)) {
    process.exitCode = 1;
  }
}

async function handleExample(args: readonly string[]): Promise<void> {
  const [subcommand, maybeId, ...rest] = args;

  if (subcommand === "list") {
    for (const example of exampleCatalog) {
      console.log(
        `${example.id.padEnd(24)} ${example.version.padEnd(5)} ${example.expectedOutcome.padEnd(4)} ${example.title}`
      );
    }
    return;
  }

  if (subcommand === "run" && maybeId) {
    const { values } = parseArgs({
      args: rest,
      options: {
        seed: { type: "string" },
        runs: { type: "string" }
      }
    });
    const example = findExample(maybeId);
    const report = await runRuntimeWorker({
      modulePath: example.modulePath,
      propertiesPath: example.propertiesPath,
      exportName: example.exportName,
      seed: parseNumber(values.seed) ?? example.defaultSeed,
      numRuns: parseNumber(values.runs) ?? example.defaultRuns
    });
    printRunSummary(report);
    if (reportHasFailures(report)) {
      process.exitCode = 1;
    }
    return;
  }

  throw new Error("Usage: counterexample-studio example <list|run>");
}

async function handleUi(args: readonly string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string" },
      open: { type: "boolean" }
    }
  });

  startStudioServer({
    port: parseNumber(values.port) ?? 4173,
    openBrowser: values.open ?? true
  });
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "run":
      await handleRun(rest);
      break;
    case "report":
      await handleReport(rest);
      break;
    case "example":
      await handleExample(rest);
      break;
    case "support":
      printSupport();
      break;
    case "ui":
      await handleUi(rest);
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command "${command}"`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
