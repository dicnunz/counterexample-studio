import type { CaseRunReport, SuiteRunReport } from "@counterexample-studio/core";

export const MAX_REPORT_BYTES = 5 * 1024 * 1024;

function invalid(path: string, expected: string): never {
  throw new Error(`Invalid report: ${path} must be ${expected}.`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "an object");
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, nonempty = false): void {
  if (typeof value !== "string" || (nonempty && !value.trim())) invalid(path, nonempty ? "a nonempty string" : "a string");
}

function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) invalid(path, `an integer from ${min} to ${max}`);
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length > 20_000) invalid(path, "an array with at most 20,000 entries");
  return value;
}

function strings(value: unknown, path: string): void {
  array(value, path).forEach((entry, index) => string(entry, `${path}[${index}]`));
}

function display(value: unknown, path: string): void {
  const entry = object(value, path);
  if (!("json" in entry)) invalid(`${path}.json`, "present");
  string(entry.preview, `${path}.preview`);
}

function field(value: unknown, path: string): void {
  const entry = object(value, path);
  string(entry.label, `${path}.label`);
  display(entry.value, `${path}.value`);
}

function validateJsonTree(value: unknown): void {
  const pending = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++visited > 500_000 || item.depth > 100) invalid("report", "JSON with at most 500,000 values and 100 nesting levels");
    const node = item.value;
    if (node === null || typeof node === "string" || typeof node === "boolean") continue;
    if (typeof node === "number" && Number.isFinite(node)) continue;
    if (typeof node !== "object") invalid("report", "JSON containing only finite numbers and serializable values");
    for (const child of Object.values(node as object)) pending.push({ value: child, depth: item.depth + 1 });
  }
}

/** Validate before rendering imported or server-provided data; never execute report content. */
export function validateSuiteReport(value: unknown): SuiteRunReport {
  validateJsonTree(value);
  const report = object(value, "report");
  for (const key of ["title", "description", "modulePath", "propertiesPath", "generatedAt"]) {
    string(report[key], key, key !== "description");
  }
  if (!Number.isFinite(Date.parse(report.generatedAt as string))) invalid("generatedAt", "a valid timestamp");
  const cases = array(report.cases, "cases");
  if (!cases.length) invalid("cases", "a nonempty array");
  const ids = new Set<string>();
  let traceCount = 0;
  function trace(value: unknown, path: string, depth = 0): void {
    if (depth > 100) invalid(path, "a trace nested at most 100 levels");
    array(value, path).forEach((node, index) => {
      if (++traceCount > 20_000) invalid("searchTrace", "at most 20,000 nodes");
      const key = `${path}[${index}]`;
      const entry = object(node, key);
      if (!["success", "failure", "skipped"].includes(entry.status as string)) invalid(`${key}.status`, "success, failure, or skipped");
      display(entry.value, `${key}.value`);
      trace(entry.children, `${key}.children`, depth + 1);
    });
  }
  cases.forEach((value, index) => {
    const path = `cases[${index}]`;
    const entry = object(value, path);
    for (const key of ["id", "label", "description", "functionName", "invariant", "modulePath", "propertiesPath", "rerunCommand"]) {
      string(entry[key], `${path}.${key}`, key !== "description" && key !== "invariant");
    }
    if (ids.has(entry.id as string)) invalid(`${path}.id`, "unique within the suite");
    ids.add(entry.id as string);
    if (entry.status !== "pass" && entry.status !== "fail") invalid(`${path}.status`, "pass or fail");
    integer(entry.seed, `${path}.seed`, -2147483648, 2147483647);
    integer(entry.numRuns, `${path}.numRuns`);
    integer(entry.numShrinks, `${path}.numShrinks`);
    if (entry.requestedRuns !== undefined) integer(entry.requestedRuns, `${path}.requestedRuns`, 1);
    if (entry.counterexamplePath !== null && (typeof entry.counterexamplePath !== "string" || !/^\d+(?::\d+)*$/.test(entry.counterexamplePath))) invalid(`${path}.counterexamplePath`, "a colon-separated numeric path or null");
    if (entry.failingInput !== null) display(entry.failingInput, `${path}.failingInput`);
    if (entry.inputArguments !== null) array(entry.inputArguments, `${path}.inputArguments`).forEach((arg, i) => display(arg, `${path}.inputArguments[${i}]`));
    for (const key of ["expected", "actual"]) if (entry[key] !== null) field(entry[key], `${path}.${key}`);
    if (entry.reproductionSnippet !== null) string(entry.reproductionSnippet, `${path}.reproductionSnippet`);
    strings(entry.notes, `${path}.notes`);
    array(entry.shrinkTrace, `${path}.shrinkTrace`).forEach((value, i) => {
      const key = `${path}.shrinkTrace[${i}]`;
      const step = object(value, key);
      integer(step.step, `${key}.step`);
      string(step.label, `${key}.label`);
      display(step.input, `${key}.input`);
      array(step.arguments, `${key}.arguments`).forEach((arg, j) => display(arg, `${key}.arguments[${j}]`));
      field(step.expected, `${key}.expected`);
      field(step.actual, `${key}.actual`);
      strings(step.notes, `${key}.notes`);
    });
    trace(entry.searchTrace, `${path}.searchTrace`);
  });
  return value as SuiteRunReport;
}

export function parseReportJson(source: string): SuiteRunReport {
  if (new TextEncoder().encode(source).byteLength > MAX_REPORT_BYTES) throw new Error("This report exceeds 5 MB. Import a smaller CLI report.");
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("This file is not valid JSON. Import the JSON report produced by Counterexample Studio.");
  }
  return validateSuiteReport(value);
}

export function serializeReport(report: SuiteRunReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function reportFilename(report: SuiteRunReport): string {
  return `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "counterexample"}-report.json`;
}

export function preferredCase(report: SuiteRunReport): CaseRunReport {
  return report.cases.find((entry) => entry.status === "fail") ?? report.cases[0]!;
}

/** Build a structured request from metadata, never from the imported shell command. */
export function replayRequest(caseReport: CaseRunReport, paths?: { modulePath: string; propertyPath: string }) {
  return {
    modulePath: paths?.modulePath ?? caseReport.modulePath,
    propertyPath: paths?.propertyPath ?? caseReport.propertiesPath,
    exportName: caseReport.functionName,
    caseId: caseReport.id,
    seed: caseReport.seed,
    runs: caseReport.requestedRuns ?? (caseReport.status === "pass" ? Math.max(caseReport.numRuns, 1) : 100),
    ...(caseReport.counterexamplePath !== null ? { path: caseReport.counterexamplePath } : {})
  };
}

