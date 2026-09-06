import type { CaseRunReport, SuiteRunReport } from "@counterexample-studio/core";
import { buildLocalPreviewCommand } from "./formatters";
import type { BundledExample, BundledRunRequest, LocalPathDraft } from "./model";
import { replayRequest, validateSuiteReport } from "./reportIO";
export { replayRequest } from "./reportIO";

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

export interface EngineResult {
  readonly report: SuiteRunReport;
  readonly elapsedMs: number;
}

export const defaultLocalPathDraft: LocalPathDraft = {
  modulePath: "./src/target.ts",
  exportName: "",
  propertyPath: "./src/target.properties.ts",
  seed: 424242,
  runs: 100
};

export function createStudioClient() {
  async function run(url: string, body: unknown): Promise<EngineResult> {
    const startedAt = performance.now();
    const response = await fetchJson<{ report: unknown }>(url, { method: "POST", body: JSON.stringify(body) });
    return { report: validateSuiteReport(response.report), elapsedMs: Math.round(performance.now() - startedAt) };
  }
  return {
    async listBundledExamples(): Promise<readonly BundledExample[]> {
      const response = await fetchJson<{ examples: readonly ApiExample[] }>("/api/examples");
      if (!Array.isArray(response.examples)) throw new Error("The local engine returned an invalid example catalog. Restart Studio and retry.");
      return response.examples.map((example) => ({
        ...example,
        target: { modulePath: example.modulePath, exportName: example.exportName, propertyPath: example.propertiesPath },
        property: { name: example.propertyName, summary: example.propertySummary, invariantLabel: example.invariantLabel }
      }));
    },
    runBundledExample(request: BundledRunRequest) {
      return run("/api/run/example", request);
    },
    runLocalPath(draft: LocalPathDraft) {
      return run("/api/run/local", { ...draft, exportName: draft.exportName.trim() || undefined });
    },
    replayCase(caseReport: CaseRunReport, paths?: { modulePath: string; propertyPath: string }) {
      return run("/api/run/local", replayRequest(caseReport, paths));
    },
    getLocalPreviewCommand: buildLocalPreviewCommand
  };
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      signal: AbortSignal.timeout(35_000)
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("The local engine did not respond within 35 seconds. Check your synchronous target and retry.");
    }
    throw new Error("Cannot reach the local engine. Start npm run studio -- ui, then retry.");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object") throw new Error("The local engine returned an invalid response. Restart Studio and retry.");
  return payload as T;
}
