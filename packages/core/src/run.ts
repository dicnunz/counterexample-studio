import path from "node:path";
import { pathToFileURL } from "node:url";
import * as fc from "fast-check";
import type { Arbitrary, ExecutionTree, Parameters } from "fast-check";
import type {
  ArrayCaseSource,
  CaseSource,
  ConstantCaseSource,
  ConstantFromCaseSource,
  DoubleCaseSource,
  FastCheckCaseSource,
  IntegerCaseSource,
  OneOfCaseSource,
  PropertyCheckResult,
  PropertyCheckReturn,
  PropertyDefinition,
  RecordCaseSource,
  StringCaseSource,
  TupleCaseSource
} from "./definitions.js";
import { CounterexampleStudioUsageError } from "./errors.js";
import {
  loadPropertySuite,
  loadTargetModule,
  resolveSuiteTargetModulePath,
  type LoadedPropertySuite
} from "./loader.js";
import {
  captureArgs,
  captureValue,
  serializeError,
  type SerializedError,
  type TupleSnapshot,
  type ValueSnapshot
} from "./serialize.js";

export type PropertyRunStatus = "passed" | "failed";
export type TraceEntryStatus = "success" | "failure" | "skipped";

export interface FinalCaseReport {
  readonly args: TupleSnapshot;
  readonly actual: ValueSnapshot | null;
  readonly actualLabel: string;
  readonly expected: ValueSnapshot | null;
  readonly expectedLabel: string;
  readonly message?: string;
  readonly error?: SerializedError;
}

export interface TraceEntry {
  readonly treePath: string;
  readonly status: TraceEntryStatus;
  readonly args: TupleSnapshot;
}

export interface PropertyRunReport {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly target: string;
  readonly invariant: string;
  readonly status: PropertyRunStatus;
  readonly interrupted: boolean;
  readonly seed: number;
  readonly requestedNumRuns: number;
  readonly executedNumRuns: number;
  readonly numSkips: number;
  readonly numShrinks: number;
  readonly counterexamplePath: string | null;
  readonly failureSequence: readonly TupleSnapshot[];
  readonly searchTrace: readonly TraceEntry[];
  readonly shrinkPath: readonly TraceEntry[];
  readonly finalCase?: FinalCaseReport;
  readonly rawError?: SerializedError;
  readonly rerunCommand: string;
  readonly reproductionSnippet: string;
}

export interface SuiteRunSummary {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
}

export interface SuiteRunReport {
  readonly schemaVersion: "1";
  readonly generatedAt: string;
  readonly suiteId: string;
  readonly suiteTitle: string;
  readonly suiteDescription?: string;
  readonly propertiesFilePath: string;
  readonly targetModulePath: string;
  readonly summary: SuiteRunSummary;
  readonly properties: readonly PropertyRunReport[];
}

export interface RunPropertySuiteOptions {
  readonly modulePath?: string;
  readonly propertyIds?: readonly string[];
  readonly seed?: number;
  readonly numRuns?: number;
  readonly path?: string;
  readonly commandName?: string;
}

interface CaseEvaluation {
  readonly pass: boolean;
  readonly actual: unknown;
  readonly actualLabel: string;
  readonly expected?: unknown;
  readonly expectedLabel: string;
  readonly message?: string;
  readonly error?: SerializedError;
}

export async function runPropertySuiteFromFiles(
  propertiesPath: string,
  options: RunPropertySuiteOptions = {}
): Promise<SuiteRunReport> {
  const loadedSuite = await loadPropertySuite(propertiesPath);
  return runLoadedPropertySuite(loadedSuite, options);
}

export async function runLoadedPropertySuite(
  loadedSuite: LoadedPropertySuite,
  options: RunPropertySuiteOptions = {}
): Promise<SuiteRunReport> {
  const requestedPropertyIds = options.propertyIds ? [...options.propertyIds] : undefined;
  if (options.path && (!requestedPropertyIds || requestedPropertyIds.length !== 1)) {
    throw new CounterexampleStudioUsageError("--path requires exactly one selected property.");
  }

  const targetModulePath = resolveSuiteTargetModulePath(loadedSuite, options.modulePath);
  const loadedTargetModule = await loadTargetModule(targetModulePath);
  const selectedProperties = selectProperties(loadedSuite, requestedPropertyIds);
  const sharedSeed = normalizeSeed(options.seed ?? defaultSeed());

  const reports = selectedProperties.map((property) =>
    runSingleProperty({
      property,
      moduleExports: loadedTargetModule.exports,
      propertiesFilePath: loadedSuite.filePath,
      targetModulePath: loadedTargetModule.filePath,
      commandName: options.commandName ?? "counterexample-studio",
      seed: sharedSeed,
      ...(options.numRuns === undefined ? {} : { numRunsOverride: options.numRuns }),
      ...(options.path === undefined ? {} : { replayPath: options.path })
    })
  );

  const summary = {
    total: reports.length,
    passed: reports.filter((report) => report.status === "passed").length,
    failed: reports.filter((report) => report.status === "failed").length
  };

  return {
    schemaVersion: "1",
    generatedAt: new Date().toISOString(),
    suiteId: loadedSuite.suite.id,
    suiteTitle: loadedSuite.suite.title,
    propertiesFilePath: loadedSuite.filePath,
    targetModulePath: loadedTargetModule.filePath,
    summary,
    properties: reports,
    ...(loadedSuite.suite.description === undefined ? {} : { suiteDescription: loadedSuite.suite.description })
  };
}

function runSingleProperty(options: {
  readonly property: PropertyDefinition;
  readonly moduleExports: Record<string, unknown>;
  readonly propertiesFilePath: string;
  readonly targetModulePath: string;
  readonly commandName: string;
  readonly seed: number;
  readonly numRunsOverride?: number;
  readonly replayPath?: string;
}): PropertyRunReport {
  const targetExport = options.moduleExports[options.property.target];
  if (typeof targetExport !== "function") {
    throw new CounterexampleStudioUsageError(
      `Target export "${options.property.target}" for property "${options.property.id}" is missing or is not a function.`
    );
  }

  const target = targetExport as (...args: readonly unknown[]) => unknown;
  const casesArbitrary = compileCaseSource(options.property.cases) as Arbitrary<readonly unknown[]>;
  const requestedNumRuns = options.numRunsOverride ?? options.property.numRuns ?? 100;
  const fastCheckParameters: Parameters<readonly unknown[]> = {
    numRuns: requestedNumRuns,
    seed: options.seed,
    verbose: fc.VerbosityLevel.VeryVerbose,
    ...(options.property.examples ? { examples: [...options.property.examples] } : {}),
    ...(options.replayPath === undefined ? {} : { path: options.replayPath })
  };

  const fastCheckProperty = fc.property(casesArbitrary, (args) => {
    const evaluation = evaluateCase({
      args: unwrapGeneratedArgs(args),
      property: options.property,
      target,
      moduleExports: options.moduleExports
    });

    if (!evaluation.pass) {
      throw new InvariantViolationError(options.property.invariant, evaluation.message);
    }
  });

  const details = fc.check(fastCheckProperty, fastCheckParameters);
  const failureSequence = details.failures.map((failureArgs) => captureArgs(unwrapGeneratedArgs(failureArgs)));
  const searchTrace = flattenExecutionSummary(details.executionSummary);
  const shrinkPath = buildShrinkPath(details.executionSummary, details.counterexamplePath);
  const rawError = details.errorInstance === null ? undefined : serializeError(details.errorInstance);
  const rerunCommand = buildRerunCommand({
    commandName: options.commandName,
    propertiesFilePath: options.propertiesFilePath,
    targetModulePath: options.targetModulePath,
    propertyId: options.property.id,
    seed: details.seed,
    counterexamplePath: details.counterexamplePath
  });
  const reproductionSnippet = buildReproductionSnippet({
    propertiesFilePath: options.propertiesFilePath,
    targetModulePath: options.targetModulePath,
    propertyId: options.property.id,
    seed: details.seed,
    counterexamplePath: details.counterexamplePath
  });

  const baseReport = {
    id: options.property.id,
    title: options.property.title,
    target: options.property.target,
    invariant: options.property.invariant,
    interrupted: details.interrupted,
    seed: details.seed,
    requestedNumRuns,
    executedNumRuns: details.numRuns,
    numSkips: details.numSkips,
    numShrinks: details.numShrinks,
    counterexamplePath: details.counterexamplePath,
    failureSequence,
    searchTrace,
    shrinkPath,
    ...(options.property.description === undefined ? {} : { description: options.property.description }),
    ...(rawError === undefined ? {} : { rawError }),
    rerunCommand,
    reproductionSnippet
  } as const;

  if (!details.failed || details.counterexample === null) {
    return {
      ...baseReport,
      status: "passed"
    };
  }

  const counterexampleArgs = unwrapGeneratedArgs(details.counterexample);
  const finalEvaluation = evaluateCase({
    args: counterexampleArgs,
    property: options.property,
    target,
    moduleExports: options.moduleExports
  });
  const finalCase: FinalCaseReport = {
    args: captureArgs(counterexampleArgs),
    actual: captureValue(finalEvaluation.actual),
    actualLabel: finalEvaluation.actualLabel,
    expected: finalEvaluation.expected === undefined ? null : captureValue(finalEvaluation.expected),
    expectedLabel: finalEvaluation.expectedLabel,
    ...(finalEvaluation.message === undefined ? {} : { message: finalEvaluation.message }),
    ...(finalEvaluation.error === undefined ? {} : { error: finalEvaluation.error })
  };

  return {
    ...baseReport,
    status: "failed",
    finalCase
  };
}

function evaluateCase(options: {
  readonly args: readonly unknown[];
  readonly property: PropertyDefinition;
  readonly target: (...args: readonly unknown[]) => unknown;
  readonly moduleExports: Record<string, unknown>;
}): CaseEvaluation {
  let actual: unknown;
  try {
    actual = options.target(...options.args);
    if (isPromiseLike(actual)) {
      throw new CounterexampleStudioUsageError(
        `Target "${options.property.target}" returned a Promise. Counterexample Studio v1 only supports synchronous targets.`
      );
    }
  } catch (error) {
    return {
      pass: false,
      actual: error,
      actualLabel: "thrown",
      expectedLabel: "expected",
      message: error instanceof Error ? error.message : "Target threw a non-Error value.",
      error: serializeError(error)
    };
  }

  try {
    return normalizeCheckResult(
      options.property.check({
        args: options.args,
        actual,
        target: options.target,
        moduleExports: options.moduleExports
      }),
      actual
    );
  } catch (error) {
    return {
      pass: false,
      actual,
      actualLabel: "actual",
      expectedLabel: "expected",
      message: error instanceof Error ? error.message : "Property check threw a non-Error value.",
      error: serializeError(error)
    };
  }
}

function normalizeCheckResult(result: PropertyCheckReturn, actual: unknown): CaseEvaluation {
  if (result === undefined || result === true) {
    return {
      pass: true,
      actual,
      actualLabel: "actual",
      expectedLabel: "expected"
    };
  }

  if (result === false) {
    return {
      pass: false,
      actual,
      actualLabel: "actual",
      expectedLabel: "expected"
    };
  }

  const normalizedResult = result as PropertyCheckResult;
  return {
    pass: normalizedResult.pass,
    actual: normalizedResult.actual === undefined ? actual : normalizedResult.actual,
    actualLabel: normalizedResult.actualLabel ?? "actual",
    expectedLabel: normalizedResult.expectedLabel ?? "expected",
    ...(normalizedResult.expected === undefined ? {} : { expected: normalizedResult.expected }),
    ...(normalizedResult.message === undefined ? {} : { message: normalizedResult.message })
  };
}

function compileCaseSource<TValue>(source: CaseSource<TValue>): Arbitrary<TValue> {
  switch (source.kind) {
    case "boolean":
      return fc.boolean() as Arbitrary<TValue>;
    case "integer":
      return fc.integer((source as IntegerCaseSource).constraints) as Arbitrary<TValue>;
    case "double":
      return fc.double((source as DoubleCaseSource).constraints) as Arbitrary<TValue>;
    case "string":
      return fc.string((source as StringCaseSource).constraints) as Arbitrary<TValue>;
    case "constant":
      return fc.constant((source as ConstantCaseSource<TValue>).value);
    case "constant-from":
      return fc.constantFrom(...(source as ConstantFromCaseSource<TValue>).values);
    case "array": {
      const arraySource = source as ArrayCaseSource<unknown>;
      return fc.array(compileCaseSource(arraySource.item), arraySource.constraints) as Arbitrary<TValue>;
    }
    case "tuple": {
      const tupleSource = source as TupleCaseSource<readonly unknown[]>;
      return fc.tuple(...tupleSource.items.map((item) => compileCaseSource(item))) as Arbitrary<TValue>;
    }
    case "record": {
      const recordSource = source as RecordCaseSource<Record<string, unknown>>;
      const compiledFields = Object.fromEntries(
        Object.entries(recordSource.fields).map(([key, value]) => [key, compileCaseSource(value)])
      );
      return fc.record(compiledFields) as Arbitrary<TValue>;
    }
    case "one-of": {
      const oneOfSource = source as OneOfCaseSource<TValue>;
      return fc.oneof(...oneOfSource.variants.map((variant) => compileCaseSource(variant)));
    }
    case "fast-check":
      return (source as FastCheckCaseSource<TValue>).arbitrary;
    default: {
      const exhaustiveSource: never = source;
      throw new CounterexampleStudioUsageError(`Unsupported case source ${(exhaustiveSource as { kind: string }).kind}.`);
    }
  }
}

function selectProperties(
  loadedSuite: LoadedPropertySuite,
  requestedPropertyIds?: readonly string[]
): readonly PropertyDefinition[] {
  if (!requestedPropertyIds || requestedPropertyIds.length === 0) {
    return loadedSuite.suite.properties;
  }

  const propertyMap = new Map(loadedSuite.suite.properties.map((property) => [property.id, property]));
  const selected = requestedPropertyIds.map((propertyId) => {
    const property = propertyMap.get(propertyId);
    if (!property) {
      throw new CounterexampleStudioUsageError(
        `Unknown property "${propertyId}" in suite "${loadedSuite.suite.id}". Available properties: ${loadedSuite.suite.properties
          .map((entry) => entry.id)
          .join(", ")}`
      );
    }
    return property;
  });

  return selected;
}

function flattenExecutionSummary(executionSummary: readonly ExecutionTree<readonly unknown[]>[]): readonly TraceEntry[] {
  const entries: TraceEntry[] = [];

  executionSummary.forEach((entry, index) => {
    visitExecutionTree(entry, String(index), entries);
  });

  return entries;
}

function visitExecutionTree(
  entry: ExecutionTree<readonly unknown[]>,
  treePath: string,
  entries: TraceEntry[]
): void {
  entries.push({
      treePath,
      status: mapExecutionStatus(entry.status),
      args: captureArgs(unwrapGeneratedArgs(entry.value))
  });

  entry.children.forEach((child, index) => {
    visitExecutionTree(child, `${treePath}:${index}`, entries);
  });
}

function buildShrinkPath(
  executionSummary: readonly ExecutionTree<readonly unknown[]>[],
  counterexamplePath: string | null
): readonly TraceEntry[] {
  if (!counterexamplePath) {
    return [];
  }

  const indices = counterexamplePath.split(":").map((segment) => Number(segment));
  if (indices.some((index) => Number.isNaN(index))) {
    return [];
  }

  const rootIndex = indices[0];
  if (rootIndex === undefined || rootIndex < 0 || rootIndex >= executionSummary.length) {
    return [];
  }

  const entries: TraceEntry[] = [];
  let currentEntry: ExecutionTree<readonly unknown[]> | undefined = executionSummary[rootIndex];
  let currentPath = String(rootIndex);

  if (currentEntry) {
    entries.push({
      treePath: currentPath,
      status: mapExecutionStatus(currentEntry.status),
      args: captureArgs(unwrapGeneratedArgs(currentEntry.value))
    });
  }

  for (const childIndex of indices.slice(1)) {
    if (!currentEntry || childIndex < 0 || childIndex >= currentEntry.children.length) {
      break;
    }

    const nextEntry = currentEntry.children[childIndex];
    if (!nextEntry) {
      break;
    }

    currentEntry = nextEntry;
    currentPath = `${currentPath}:${childIndex}`;
    entries.push({
      treePath: currentPath,
      status: mapExecutionStatus(currentEntry.status),
      args: captureArgs(unwrapGeneratedArgs(currentEntry.value))
    });
  }

  return entries;
}

function mapExecutionStatus(status: fc.ExecutionStatus): TraceEntryStatus {
  if (status === fc.ExecutionStatus.Success) {
    return "success";
  }

  if (status === fc.ExecutionStatus.Skipped) {
    return "skipped";
  }

  return "failure";
}

function unwrapGeneratedArgs(generatedValue: readonly unknown[]): readonly unknown[] {
  if (generatedValue.length === 1 && Array.isArray(generatedValue[0])) {
    return generatedValue[0];
  }

  return generatedValue;
}

function buildRerunCommand(options: {
  readonly commandName: string;
  readonly propertiesFilePath: string;
  readonly targetModulePath: string;
  readonly propertyId: string;
  readonly seed: number;
  readonly counterexamplePath: string | null;
}): string {
  const parts = [
    options.commandName,
    "run",
    "--properties",
    quoteShellArg(options.propertiesFilePath),
    "--module",
    quoteShellArg(options.targetModulePath),
    "--property",
    quoteShellArg(options.propertyId),
    "--seed",
    String(options.seed)
  ];

  if (options.counterexamplePath) {
    parts.push("--path", quoteShellArg(options.counterexamplePath));
  }

  return parts.join(" ");
}

function buildReproductionSnippet(options: {
  readonly propertiesFilePath: string;
  readonly targetModulePath: string;
  readonly propertyId: string;
  readonly seed: number;
  readonly counterexamplePath: string | null;
}): string {
  const snippetOptions = [
    `modulePath: ${JSON.stringify(options.targetModulePath)}`,
    `propertyIds: [${JSON.stringify(options.propertyId)}]`,
    `seed: ${options.seed}`
  ];

  if (options.counterexamplePath) {
    snippetOptions.push(`path: ${JSON.stringify(options.counterexamplePath)}`);
  }

  return [
    'import { loadPropertySuite, runLoadedPropertySuite } from "@counterexample-studio/core";',
    "",
    `const suite = await loadPropertySuite(${JSON.stringify(options.propertiesFilePath)});`,
    "const report = await runLoadedPropertySuite(suite, {",
    `  ${snippetOptions.join(",\n  ")}`,
    "});",
    "",
    "console.log(report.properties[0]);"
  ].join("\n");
}

function quoteShellArg(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && "then" in value && typeof value.then === "function";
}

function normalizeSeed(value: number): number {
  const normalized = Math.trunc(value);
  return Number.isFinite(normalized) ? normalized : defaultSeed();
}

function defaultSeed(): number {
  return Date.now() % 0x7fffffff;
}

class InvariantViolationError extends Error {
  public constructor(invariant: string, detail?: string) {
    super(detail ? `${invariant}: ${detail}` : invariant);
    this.name = "InvariantViolationError";
  }
}

export function toJsonReport(report: SuiteRunReport): string {
  return JSON.stringify(report, null, 2);
}

export function parseJsonReport(jsonReport: string): SuiteRunReport {
  return JSON.parse(jsonReport) as SuiteRunReport;
}

export function summarizeProperty(property: PropertyRunReport): string {
  const header = `${property.status === "passed" ? "PASS" : "FAIL"} ${property.id} target=${property.target} seed=${property.seed}`;
  if (property.status === "passed") {
    return `${header} runs=${property.executedNumRuns}`;
  }

  const finalCase = property.finalCase;
  const finalSummary = finalCase ? ` args=${finalCase.args.summary}` : "";
  return `${header} path=${property.counterexamplePath ?? "n/a"} shrinks=${property.numShrinks}${finalSummary}`;
}

export function resolveReproductionModuleUrl(filePath: string): string {
  return pathToFileURL(path.resolve(filePath)).href;
}
