import type { Arbitrary } from "fast-check";

export interface DisplayValue {
  readonly json: unknown;
  readonly preview: string;
}

export interface DisplayField {
  readonly label: string;
  readonly value: DisplayValue;
}

export interface InvariantCheckResult {
  readonly pass: boolean;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly expectedLabel?: string;
  readonly actualLabel?: string;
  readonly notes?: readonly string[];
}

export interface PropertyRunContext<TModule, TInput, TResult> {
  readonly module: TModule;
  readonly fn: (...args: readonly unknown[]) => TResult;
  readonly functionName: string;
  readonly input: TInput;
  readonly args: readonly unknown[];
}

export interface ReproductionContext<TModule, TInput, TResult> extends PropertyRunContext<TModule, TInput, TResult> {
  readonly modulePath: string;
  readonly propertiesPath: string;
  readonly check: InvariantCheckResult;
}

export interface PropertyDefinition<TModule, TInput, TResult = unknown> {
  readonly id: string;
  readonly label: string;
  readonly functionName: keyof TModule & string;
  readonly description?: string;
  readonly arbitrary: Arbitrary<TInput>;
  readonly examples?: readonly TInput[];
  readonly renderInvariant: (input: TInput) => string;
  readonly getArgs: (input: TInput) => readonly unknown[];
  readonly run: (context: PropertyRunContext<TModule, TInput, TResult>) => InvariantCheckResult;
  readonly renderInput?: (input: TInput) => string;
  readonly makeReproductionSnippet?: (context: ReproductionContext<TModule, TInput, TResult>) => string;
}

export interface PropertySuite<TModule = Record<string, unknown>> {
  readonly title: string;
  readonly description?: string;
  readonly properties: readonly PropertyDefinition<TModule, any, any>[];
}

export interface RunSuiteOptions {
  readonly modulePath: string;
  readonly propertiesPath: string;
  readonly commandPrefix?: string;
  readonly caseId?: string;
  readonly seed?: number;
  readonly path?: string;
  readonly numRuns?: number;
}

export interface SearchTraceNode {
  readonly status: "success" | "failure" | "skipped";
  readonly value: DisplayValue;
  readonly children: readonly SearchTraceNode[];
}

export interface ShrinkTraceStep {
  readonly step: number;
  readonly label: string;
  readonly input: DisplayValue;
  readonly arguments: readonly DisplayValue[];
  readonly expected: DisplayField;
  readonly actual: DisplayField;
  readonly notes: readonly string[];
}

export interface CaseRunReport {
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
  readonly failingInput: DisplayValue | null;
  readonly inputArguments: readonly DisplayValue[] | null;
  readonly expected: DisplayField | null;
  readonly actual: DisplayField | null;
  readonly shrinkTrace: readonly ShrinkTraceStep[];
  readonly searchTrace: readonly SearchTraceNode[];
  readonly reproductionSnippet: string | null;
  readonly notes: readonly string[];
}

export interface SuiteRunReport {
  readonly title: string;
  readonly description: string;
  readonly modulePath: string;
  readonly propertiesPath: string;
  readonly generatedAt: string;
  readonly cases: readonly CaseRunReport[];
}
