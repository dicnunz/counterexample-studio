import { buildLocalPreviewCommand } from "./formatters";
import type {
  BlockedRunReport,
  BundledExample,
  BundledRunRequest,
  LocalPathDraft,
  RunReport,
  TraceEntry
} from "./model";

interface ApiExample {
  readonly id: string;
  readonly family: string;
  readonly title: string;
  readonly description: string;
  readonly exportName: string;
  readonly propertyName: string;
  readonly propertySummary: string;
  readonly invariantLabel: string;
  readonly version: "buggy" | "fixed";
  readonly expectedOutcome: "fail" | "pass";
  readonly tags: readonly string[];
  readonly highlights: readonly string[];
  readonly defaultSeed: number;
  readonly defaultRuns: number;
  readonly modulePath: string;
  readonly propertiesPath: string;
}

interface ApiDisplayValue {
  readonly json: unknown;
  readonly preview: string;
}

interface ApiDisplayField {
  readonly label: string;
  readonly value: ApiDisplayValue;
}

interface ApiSearchTraceNode {
  readonly status: "success" | "failure" | "skipped";
  readonly value: ApiDisplayValue;
  readonly children: readonly ApiSearchTraceNode[];
}

interface ApiShrinkTraceStep {
  readonly step: number;
  readonly label: string;
  readonly input: ApiDisplayValue;
  readonly arguments: readonly ApiDisplayValue[];
  readonly expected: ApiDisplayField;
  readonly actual: ApiDisplayField;
  readonly notes: readonly string[];
}

interface ApiCaseReport {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly functionName: string;
  readonly invariant: string;
  readonly status: "pass" | "fail";
  readonly seed: number;
  readonly numRuns: number;
  readonly numShrinks: number;
  readonly counterexamplePath: string | null;
  readonly rerunCommand: string;
  readonly modulePath: string;
  readonly propertiesPath: string;
  readonly failingInput: ApiDisplayValue | null;
  readonly inputArguments: readonly ApiDisplayValue[] | null;
  readonly expected: ApiDisplayField | null;
  readonly actual: ApiDisplayField | null;
  readonly shrinkTrace: readonly ApiShrinkTraceStep[];
  readonly searchTrace: readonly ApiSearchTraceNode[];
  readonly reproductionSnippet: string | null;
  readonly notes: readonly string[];
}

interface ApiSuiteReport {
  readonly cases: readonly ApiCaseReport[];
}

interface ExamplesResponse {
  readonly examples: readonly ApiExample[];
}

interface ExampleRunResponse {
  readonly example: ApiExample;
  readonly report: ApiSuiteReport;
}

interface LocalRunResponse {
  readonly report: ApiSuiteReport;
}

interface SuiteSelection {
  readonly caseReport: ApiCaseReport;
  readonly property: BundledExample["property"];
  readonly suiteNotes: readonly string[];
}

export const defaultLocalPathDraft: LocalPathDraft = {
  modulePath: "./src/target.ts",
  exportName: "subjectUnderTest",
  propertyPath: "./src/target.properties.ts",
  seed: 424242,
  runs: 100
};

export function createDemoStudioClient() {
  return {
    adapterName: "Shared local engine",
    localPathMode: "live",
    async listBundledExamples(): Promise<readonly BundledExample[]> {
      const response = await fetchJson<ExamplesResponse>("/api/examples");
      return response.examples.map(mapExample);
    },
    async runBundledExample(request: BundledRunRequest): Promise<RunReport> {
      const startedAt = performance.now();
      const response = await fetchJson<ExampleRunResponse>("/api/run/example", {
        method: "POST",
        body: JSON.stringify(request)
      });
      return mapRunReport(response.report, mapExample(response.example), performance.now() - startedAt);
    },
    async runLocalPath(draft: LocalPathDraft): Promise<RunReport> {
      const startedAt = performance.now();

      try {
        const response = await fetchJson<LocalRunResponse>("/api/run/local", {
          method: "POST",
          body: JSON.stringify({
            modulePath: draft.modulePath,
            propertyPath: draft.propertyPath,
            exportName: draft.exportName,
            seed: draft.seed,
            runs: draft.runs
          })
        });

        return mapRunReport(
          response.report,
          {
            id: "local-path",
            family: "Local files",
            title: "Local file execution",
            version: "fixed",
            description: "Runs a user-provided module and property file locally.",
            target: {
              modulePath: draft.modulePath,
              exportName: draft.exportName,
              propertyPath: draft.propertyPath
            },
            property: {
              name: "local-files-property",
              summary: "Runs the selected property file against the chosen local export.",
              invariantLabel: "evaluate the supplied property definition"
            },
            defaultSeed: draft.seed,
            defaultRuns: draft.runs,
            expectedOutcome: "pass",
            tags: ["local"],
            highlights: [
              "Uses the same deterministic seed and run count as the CLI.",
              "Works against local JS/TS modules through the shared engine."
            ]
          },
          performance.now() - startedAt
        );
      } catch (error) {
        return {
          kind: "blocked",
          adapterName: "Shared local engine",
          seed: draft.seed,
          runs: draft.runs,
          elapsedMs: Math.round(performance.now() - startedAt),
          target: {
            modulePath: draft.modulePath,
            exportName: draft.exportName,
            propertyPath: draft.propertyPath
          },
          property: {
            name: "local-files-property",
            summary: "The local run returned an error before a report could be produced.",
            invariantLabel: "evaluate the supplied property definition"
          },
          rerunCommand: buildLocalPreviewCommand(draft),
          reproductionSnippet: buildLocalPreviewCommand(draft),
          trace: [],
          notes: ["Fix the path or property definition and rerun with the same seed."],
          message: error instanceof Error ? error.message : String(error),
          nextSteps: [
            "Verify the target module path and property file path.",
            "Make sure the property file exports a default property suite.",
            "Keep the seed and run count if you want a deterministic retry."
          ]
        } satisfies BlockedRunReport;
      }
    },
    getLocalPreviewCommand(draft: LocalPathDraft) {
      return buildLocalPreviewCommand(draft);
    }
  };
}

export type StudioClient = ReturnType<typeof createDemoStudioClient>;

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "content-type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function mapExample(example: ApiExample): BundledExample {
  return {
    id: example.id,
    family: example.family,
    title: example.title,
    version: example.version,
    description: example.description,
    target: {
      modulePath: example.modulePath,
      exportName: example.exportName,
      propertyPath: example.propertiesPath
    },
    property: {
      name: example.propertyName,
      summary: example.propertySummary,
      invariantLabel: example.invariantLabel
    },
    defaultSeed: example.defaultSeed,
    defaultRuns: example.defaultRuns,
    expectedOutcome: example.expectedOutcome,
    tags: example.tags,
    highlights: example.highlights
  };
}

function flattenSearchTrace(
  nodes: readonly ApiSearchTraceNode[],
  entries: TraceEntry[],
  runIndex = { value: 1 }
): void {
  for (const node of nodes) {
    entries.push({
      id: `search-${runIndex.value}`,
      phase: "search",
      outcome:
        node.status === "failure"
          ? "counterexample"
          : node.status === "success"
            ? "pass"
            : "rejected",
      label:
        node.status === "failure"
          ? `Counterexample attempt ${runIndex.value}`
          : node.status === "success"
            ? `Search attempt ${runIndex.value}`
            : `Skipped attempt ${runIndex.value}`,
      note:
        node.status === "failure"
          ? "The property failed on this candidate during the search tree."
          : node.status === "success"
            ? "This candidate satisfied the property."
            : "This candidate was skipped during generation.",
      runIndex: runIndex.value,
      size: node.value.preview.length,
      input: asJsonTuple(node.value.json),
      actual: null
    });
    runIndex.value += 1;
    flattenSearchTrace(node.children, entries, runIndex);
  }
}

function selectSuiteCase(report: ApiSuiteReport, example: BundledExample): SuiteSelection {
  const caseReport = report.cases.find((entry) => entry.status === "fail") ?? report.cases[0];
  if (!caseReport) {
    throw new Error("The engine returned an empty report");
  }

  const failureCount = report.cases.filter((entry) => entry.status === "fail").length;
  const suiteNotes =
    report.cases.length > 1
      ? [`Suite summary: ${report.cases.length - failureCount} passed, ${failureCount} failed. Showing ${caseReport.label}.`]
      : [];

  return {
    caseReport,
    property:
      report.cases.length > 1
        ? {
            name: caseReport.label,
            summary: caseReport.description,
            invariantLabel: caseReport.invariant
          }
        : example.property,
    suiteNotes
  };
}

function mapRunReport(report: ApiSuiteReport, example: BundledExample, elapsedMs: number): RunReport {
  const selection = selectSuiteCase(report, example);
  const { caseReport } = selection;

  const trace: TraceEntry[] = [];
  flattenSearchTrace(caseReport.searchTrace, trace);
  trace.push(
    ...caseReport.shrinkTrace.map((entry) => ({
      id: `shrink-${entry.step}`,
      phase: "shrink" as const,
      outcome: "accepted" as const,
      label: entry.label,
      note: entry.notes[0] ?? "A shrink candidate preserved the failure and stayed on the minimal path.",
      runIndex: caseReport.numRuns,
      size: entry.input.preview.length,
      input: asJsonTuple(entry.input.json),
      actual: entry.actual.value.json as never
    }))
  );

  if (caseReport.status === "pass") {
    return {
      kind: "pass",
      adapterName: "Shared local engine",
      seed: caseReport.seed,
      runs: caseReport.numRuns,
      elapsedMs: Math.round(elapsedMs),
      target: example.target,
      property: selection.property,
      rerunCommand: caseReport.rerunCommand,
      reproductionSnippet: caseReport.reproductionSnippet ?? caseReport.rerunCommand,
      trace,
      notes: [...selection.suiteNotes, "Passed all sampled runs.", ...caseReport.notes],
      summary:
        report.cases.length > 1
          ? `All ${report.cases.length} properties completed for ${caseReport.numRuns} deterministic runs.`
          : `Property holds for ${caseReport.numRuns} deterministic runs.`
    };
  }

  return {
    kind: "fail",
    adapterName: "Shared local engine",
    seed: caseReport.seed,
    runs: caseReport.numRuns,
    elapsedMs: Math.round(elapsedMs),
    target: example.target,
    property: selection.property,
    rerunCommand: caseReport.rerunCommand,
    reproductionSnippet: caseReport.reproductionSnippet ?? caseReport.rerunCommand,
    trace,
    notes: [...selection.suiteNotes, ...caseReport.notes],
    discoveredAtRun: caseReport.numRuns,
    shrinkCount: caseReport.numShrinks,
    failureMessage: `${caseReport.label} produced a reproducible counterexample.`,
    minimalInput: caseReport.inputArguments?.map((value) => value.json as never) ?? [],
    actualResult: caseReport.actual?.value.json as never,
    expectedLabel: caseReport.expected?.value.preview ?? caseReport.invariant,
    shrinkPath: caseReport.shrinkTrace.map((entry) => ({
      step: entry.step + 1,
      label: entry.label,
      note: entry.notes[0] ?? "Accepted along the shrinking path.",
      accepted: true,
      input: asJsonTuple(entry.input.json),
      actual: entry.actual.value.json as never
    }))
  };
}

function asJsonTuple(value: unknown): readonly never[] {
  if (Array.isArray(value)) {
    return value as never[];
  }
  return [value] as never[];
}
