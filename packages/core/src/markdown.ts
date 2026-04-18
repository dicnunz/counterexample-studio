import type { PropertyRunReport, SuiteRunReport, TraceEntry } from "./run.js";

export function renderMarkdownReport(report: SuiteRunReport): string {
  const lines: string[] = [
    "# Counterexample Studio Report",
    "",
    `- Suite: \`${report.suiteId}\``,
    `- Title: ${report.suiteTitle}`,
    `- Properties file: \`${report.propertiesFilePath}\``,
    `- Target module: \`${report.targetModulePath}\``,
    `- Generated at: ${report.generatedAt}`,
    `- Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.total} total`,
    ""
  ];

  for (const property of report.properties) {
    lines.push(`## ${property.id}`, "");
    lines.push(`- Status: ${property.status}`);
    lines.push(`- Title: ${property.title}`);
    lines.push(`- Target: \`${property.target}\``);
    lines.push(`- Invariant: ${property.invariant}`);
    lines.push(`- Seed: ${property.seed}`);
    lines.push(`- Runs: ${property.executedNumRuns}/${property.requestedNumRuns}`);
    lines.push(`- Shrinks: ${property.numShrinks}`);
    lines.push(`- Counterexample path: ${property.counterexamplePath ?? "n/a"}`);
    lines.push(`- Rerun: \`${property.rerunCommand}\``);
    lines.push("");

    if (property.description) {
      lines.push(property.description, "");
    }

    if (property.status === "failed" && property.finalCase) {
      lines.push("### Minimal Counterexample", "");
      lines.push(`- Args: \`${property.finalCase.args.summary}\``);
      lines.push(`- ${property.finalCase.actualLabel}: \`${property.finalCase.actual?.summary ?? "null"}\``);
      if (property.finalCase.expected) {
        lines.push(`- ${property.finalCase.expectedLabel}: \`${property.finalCase.expected.summary}\``);
      }
      if (property.finalCase.message) {
        lines.push(`- Message: ${property.finalCase.message}`);
      }
      if (property.finalCase.error) {
        lines.push(`- Error: ${property.finalCase.error.summary}`);
      }
      lines.push("");
    }

    if (property.failureSequence.length > 0) {
      lines.push("### Failing Inputs During Shrinking", "");
      property.failureSequence.forEach((failure, index) => {
        lines.push(`${index + 1}. \`${failure.summary}\``);
      });
      lines.push("");
    }

    if (property.shrinkPath.length > 0) {
      lines.push("### Shrink Path", "");
      lines.push(...renderTrace(property.shrinkPath));
      lines.push("");
    }

    if (property.searchTrace.length > 0) {
      lines.push("### Search Trace", "");
      lines.push(...renderTrace(property.searchTrace));
      lines.push("");
    }

    lines.push("### Reproduction Snippet", "", "```ts", property.reproductionSnippet, "```", "");
  }

  return lines.join("\n").trimEnd();
}

function renderTrace(trace: readonly TraceEntry[]): readonly string[] {
  return trace.map((entry, index) => `${index + 1}. \`${entry.treePath}\` ${entry.status} ${entry.args.summary}`);
}

export function renderSummary(report: SuiteRunReport): string {
  const lines = [
    `Suite ${report.suiteId}: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.total} total`
  ];

  for (const property of report.properties) {
    lines.push(renderPropertySummary(property));
  }

  return lines.join("\n");
}

function renderPropertySummary(property: PropertyRunReport): string {
  if (property.status === "passed") {
    return `- PASS ${property.id} seed=${property.seed} runs=${property.executedNumRuns}`;
  }

  const summary = property.finalCase ? property.finalCase.args.summary : "n/a";
  return `- FAIL ${property.id} seed=${property.seed} path=${property.counterexamplePath ?? "n/a"} args=${summary}`;
}
