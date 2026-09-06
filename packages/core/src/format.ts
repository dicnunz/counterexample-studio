import type { CaseRunReport, DisplayValue, SuiteRunReport } from "./contracts.js";

function normalizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack ?? ""
  };
}

export function toJsonSafe(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  if (typeof value === "function") {
    return `[Function ${(value as (...args: readonly unknown[]) => unknown).name || "anonymous"}]`;
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  if (typeof value === "undefined") {
    return "[undefined]";
  }
  if (value instanceof Error) {
    return normalizeError(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry, seen)])
    );
  }
  return value;
}

export function formatPreview(value: unknown): string {
  const safe = toJsonSafe(value);
  if (typeof safe === "string") {
    return safe;
  }
  return JSON.stringify(safe, null, 2);
}

export function asDisplayValue(value: unknown): DisplayValue {
  return {
    json: toJsonSafe(value),
    preview: formatPreview(value)
  };
}

export function shellEscape(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function buildRerunCommand(
  report: Pick<CaseRunReport, "modulePath" | "propertiesPath" | "id" | "seed" | "counterexamplePath"> & {
    readonly commandPrefix?: string;
    readonly requestedRuns?: number;
    readonly functionName?: string;
  }
): string {
  const parts = [
    report.commandPrefix?.trim() || "counterexample-studio run",
    "--module",
    shellEscape(report.modulePath),
    "--properties",
    shellEscape(report.propertiesPath),
    "--case",
    shellEscape(report.id),
    "--seed",
    String(report.seed)
  ];
  if (report.functionName) {
    parts.push("--export", shellEscape(report.functionName));
  }
  if (report.requestedRuns !== undefined) {
    parts.push("--runs", String(report.requestedRuns));
  }
  if (report.counterexamplePath) {
    parts.push("--path", shellEscape(report.counterexamplePath));
  }
  return parts.join(" ");
}

function javascriptLiteral(value: unknown, seen: WeakSet<object>): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Object.is(value, -0) ? "-0" : String(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value !== "object" || seen.has(value)) throw new Error("Input requires the saved property replay");
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1 || !descriptors.length?.writable) throw new Error("Input requires the saved property replay");
    for (let index = 0; index < value.length; index++) {
      const descriptor = descriptors[index];
      if (!descriptor?.enumerable || !descriptor.configurable || !descriptor.writable || !("value" in descriptor)) throw new Error("Input requires the saved property replay");
    }
    return `[${value.map((item) => javascriptLiteral(item, seen)).join(", ")}]`;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length || Object.values(descriptors).some((descriptor) => !descriptor.enumerable || !descriptor.configurable || !descriptor.writable || !("value" in descriptor))) throw new Error("Input requires the saved property replay");
  return `{ ${Object.entries(value).map(([key, entry]) => `[${JSON.stringify(key)}]: ${javascriptLiteral(entry, seen)}`).join(", ")} }`;
}

export function buildGenericReproductionSnippet(input: {
  readonly modulePath: string;
  readonly functionName: string;
  readonly args: readonly unknown[];
}): string {
  let argsSource: string;
  try {
    const seen = new WeakSet<object>();
    argsSource = input.args.map((arg) => javascriptLiteral(arg, seen)).join(", ");
  } catch {
    return "// This input contains values a standalone snippet cannot preserve.\n// Use the saved CLI rerun command to regenerate the original input.";
  }
  return [
    `import * as targetModule from ${JSON.stringify(input.modulePath)};`,
    "",
    `const actual = targetModule[${JSON.stringify(input.functionName)}](${argsSource});`,
    "console.log(actual);"
  ].join("\n");
}

export function renderMarkdownReport(report: SuiteRunReport): string {
  const lines: string[] = [
    `# ${report.title}`,
    "",
    report.description,
    "",
    `- Generated: ${report.generatedAt}`,
    `- Module: \`${report.modulePath}\``,
    `- Properties: \`${report.propertiesPath}\``,
    ""
  ];

  for (const caseReport of report.cases) {
    lines.push(`## ${caseReport.label}`);
    lines.push("");
    lines.push(`- Status: **${caseReport.status.toUpperCase()}**`);
    lines.push(`- Function: \`${caseReport.functionName}\``);
    lines.push(`- Seed: \`${caseReport.seed}\``);
    lines.push(`- Counterexample path: \`${caseReport.counterexamplePath ?? "n/a"}\``);
    lines.push(`- Rerun: \`${caseReport.rerunCommand}\``);
    lines.push("");
    lines.push(caseReport.description);
    lines.push("");
    lines.push("### Invariant");
    lines.push("");
    lines.push(caseReport.invariant);
    lines.push("");

    if (caseReport.failingInput) {
      lines.push("### Failing Input");
      lines.push("");
      lines.push("```json");
      lines.push(caseReport.failingInput.preview);
      lines.push("```");
      lines.push("");
    }

    if (caseReport.expected && caseReport.actual) {
      lines.push("### Expected vs Actual");
      lines.push("");
      lines.push(`- ${caseReport.expected.label}`);
      lines.push("```json");
      lines.push(caseReport.expected.value.preview);
      lines.push("```");
      lines.push(`- ${caseReport.actual.label}`);
      lines.push("```json");
      lines.push(caseReport.actual.value.preview);
      lines.push("```");
      lines.push("");
    }

    if (caseReport.shrinkTrace.length > 0) {
      lines.push("### Shrink Trace");
      lines.push("");
      for (const step of caseReport.shrinkTrace) {
        lines.push(`- Step ${step.step + 1}: ${step.label}`);
        lines.push(`  Input: \`${step.input.preview.replaceAll("\n", " ")}\``);
      }
      lines.push("");
    }

    if (caseReport.reproductionSnippet) {
      lines.push("### Minimal Reproduction");
      lines.push("");
      lines.push("```ts");
      lines.push(caseReport.reproductionSnippet);
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}
