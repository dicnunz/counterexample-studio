export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface TargetDescriptor {
  readonly modulePath: string;
  readonly exportName: string;
  readonly propertyPath: string;
}

export interface PropertyDescriptor {
  readonly name: string;
  readonly summary: string;
  readonly invariantLabel: string;
}

export interface BundledExample {
  readonly id: string;
  readonly family: string;
  readonly title: string;
  readonly version: "buggy" | "fixed";
  readonly description: string;
  readonly target: TargetDescriptor;
  readonly property: PropertyDescriptor;
  readonly defaultSeed: number;
  readonly defaultRuns: number;
  readonly expectedOutcome: "fail" | "pass";
  readonly tags: readonly string[];
  readonly highlights: readonly string[];
}

export interface TraceEntry {
  readonly id: string;
  readonly phase: "search" | "shrink";
  readonly outcome: "pass" | "counterexample" | "accepted" | "rejected";
  readonly label: string;
  readonly note: string;
  readonly runIndex: number;
  readonly size: number;
  readonly input: readonly JsonValue[];
  readonly actual: JsonValue | null;
}

export interface ShrinkEntry {
  readonly step: number;
  readonly label: string;
  readonly note: string;
  readonly accepted: boolean;
  readonly input: readonly JsonValue[];
  readonly actual: JsonValue;
}

export interface BaseRunReport {
  readonly kind: "pass" | "fail" | "blocked";
  readonly adapterName: string;
  readonly seed: number;
  readonly runs: number;
  readonly elapsedMs: number;
  readonly target: TargetDescriptor;
  readonly property: PropertyDescriptor;
  readonly rerunCommand: string;
  readonly reproductionSnippet: string;
  readonly trace: readonly TraceEntry[];
  readonly notes: readonly string[];
}

export interface FailureRunReport extends BaseRunReport {
  readonly kind: "fail";
  readonly discoveredAtRun: number;
  readonly shrinkCount: number;
  readonly failureMessage: string;
  readonly minimalInput: readonly JsonValue[];
  readonly actualResult: JsonValue;
  readonly expectedLabel: string;
  readonly shrinkPath: readonly ShrinkEntry[];
}

export interface PassRunReport extends BaseRunReport {
  readonly kind: "pass";
  readonly summary: string;
}

export interface BlockedRunReport extends BaseRunReport {
  readonly kind: "blocked";
  readonly message: string;
  readonly nextSteps: readonly string[];
}

export type RunReport = FailureRunReport | PassRunReport | BlockedRunReport;

export interface BundledRunRequest {
  readonly exampleId: string;
  readonly seed: number;
  readonly runs: number;
}

export interface LocalPathDraft {
  readonly modulePath: string;
  readonly exportName: string;
  readonly propertyPath: string;
  readonly seed: number;
  readonly runs: number;
}
