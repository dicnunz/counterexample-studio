import fc from "fast-check";
import type {
  CaseRunReport,
  InvariantCheckResult,
  PropertyDefinition,
  PropertyRunContext,
  PropertySuite,
  RunSuiteOptions,
  SearchTraceNode,
  ShrinkTraceStep,
  SuiteRunReport
} from "./contracts.js";
import { asDisplayValue, buildGenericReproductionSnippet, buildRerunCommand } from "./format.js";

interface FailureSnapshot {
  readonly input: unknown;
  readonly args: readonly unknown[];
  readonly check: InvariantCheckResult;
}

function asFunction<TModule>(targetModule: TModule, definition: PropertyDefinition<TModule, unknown, unknown>): (...args: readonly unknown[]) => unknown {
  const candidate = targetModule[definition.functionName];
  if (typeof candidate !== "function") {
    throw new Error(`Expected export "${definition.functionName}" to be a function`);
  }
  return candidate as (...args: readonly unknown[]) => unknown;
}

function buildFailureCheck(error: unknown): InvariantCheckResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    pass: false,
    expected: "Function to satisfy the invariant without throwing",
    actual: {
      thrown: message
    },
    expectedLabel: "Expected invariant",
    actualLabel: "Thrown error",
    notes: ["The target function or invariant evaluation threw during execution."]
  };
}

function recordFailure(failures: FailureSnapshot[], input: unknown, args: readonly unknown[], check: InvariantCheckResult): void {
  failures.push({
    input,
    args,
    check
  });
}

function mapStatus(status: number): "success" | "failure" | "skipped" {
  if (status === 1) {
    return "failure";
  }
  if (status === -1) {
    return "skipped";
  }
  return "success";
}

function buildSearchTrace(tree: readonly { readonly status: number; readonly value: unknown; readonly children: readonly unknown[]; }[]): SearchTraceNode[] {
  return tree.map((node) => ({
    status: mapStatus(node.status),
    value: asDisplayValue(node.value),
    children: buildSearchTrace(node.children as readonly { readonly status: number; readonly value: unknown; readonly children: readonly unknown[]; }[])
  }));
}

function buildShrinkTrace(failures: readonly FailureSnapshot[]): ShrinkTraceStep[] {
  return failures.map((failure, index) => ({
    step: index,
    label: index === failures.length - 1 ? "Minimal counterexample" : "Shrunk failing case",
    input: asDisplayValue(failure.input),
    arguments: failure.args.map((arg) => asDisplayValue(arg)),
    expected: {
      label: failure.check.expectedLabel ?? "Expected invariant",
      value: asDisplayValue(failure.check.expected)
    },
    actual: {
      label: failure.check.actualLabel ?? "Actual result",
      value: asDisplayValue(failure.check.actual)
    },
    notes: failure.check.notes ?? []
  }));
}

function buildDescription<TModule>(definition: PropertyDefinition<TModule, unknown, unknown>): string {
  return definition.description ?? definition.label;
}

export function defineProperties<TModule>(suite: PropertySuite<TModule>): PropertySuite<TModule> {
  return suite;
}

export { fc };

export function runPropertySuite<TModule extends Record<string, unknown>>(
  targetModule: TModule,
  suite: PropertySuite<TModule>,
  options: RunSuiteOptions
): SuiteRunReport {
  const selectedProperties = options.caseId
    ? suite.properties.filter((property) => property.id === options.caseId)
    : suite.properties;

  if (selectedProperties.length === 0) {
    throw new Error(`No property matched case id "${options.caseId}"`);
  }

  const cases: CaseRunReport[] = selectedProperties.map((definition) => {
    const fn = asFunction(targetModule, definition);
    const failures: FailureSnapshot[] = [];

    const property = fc.property(definition.arbitrary, (input) => {
      const args = definition.getArgs(input);
      const context: PropertyRunContext<TModule, unknown, unknown> = {
        module: targetModule,
        fn,
        functionName: definition.functionName,
        input,
        args
      };

      let check: InvariantCheckResult;
      try {
        check = definition.run(context);
        if (check.pass && check.actual instanceof Promise) {
          throw new Error("Async results are not supported in v1");
        }
      } catch (error) {
        check = buildFailureCheck(error);
      }

      if (!check.pass) {
        recordFailure(failures, input, args, check);
      }

      return check.pass;
    });

    const fcParameters: fc.Parameters<[unknown]> = {
      numRuns: options.numRuns ?? 100,
      verbose: fc.VerbosityLevel.VeryVerbose
    };
    if (options.seed !== undefined) {
      fcParameters.seed = options.seed;
    }
    if (options.path !== undefined) {
      fcParameters.path = options.path;
    }
    if (definition.examples !== undefined) {
      fcParameters.examples = definition.examples.map((example) => [example]);
    }

    const runDetails = fc.check(property, fcParameters);

    const finalFailure = failures[failures.length - 1];
    const invariantSource = (runDetails.counterexample?.[0] ?? definition.examples?.[0] ?? null) as unknown;
    const invariant = invariantSource === null ? definition.label : definition.renderInvariant(invariantSource);
    const shrinkTrace = buildShrinkTrace(failures);
    const baseReport: CaseRunReport = {
      id: definition.id,
      label: definition.label,
      description: buildDescription(definition),
      functionName: definition.functionName,
      invariant,
      status: runDetails.failed ? "fail" : "pass",
      seed: runDetails.seed,
      numRuns: runDetails.numRuns,
      numShrinks: runDetails.numShrinks,
      counterexamplePath: runDetails.counterexamplePath,
      modulePath: options.modulePath,
      propertiesPath: options.propertiesPath,
      rerunCommand: "",
      failingInput: finalFailure ? asDisplayValue(finalFailure.input) : null,
      inputArguments: finalFailure ? finalFailure.args.map((arg) => asDisplayValue(arg)) : null,
      expected: finalFailure
        ? {
            label: finalFailure.check.expectedLabel ?? "Expected invariant",
            value: asDisplayValue(finalFailure.check.expected)
          }
        : null,
      actual: finalFailure
        ? {
            label: finalFailure.check.actualLabel ?? "Actual result",
            value: asDisplayValue(finalFailure.check.actual)
          }
        : null,
      shrinkTrace,
      searchTrace: buildSearchTrace(runDetails.executionSummary as readonly { readonly status: number; readonly value: unknown; readonly children: readonly unknown[]; }[]),
      reproductionSnippet: finalFailure
        ? definition.makeReproductionSnippet?.({
            module: targetModule,
            fn,
            functionName: definition.functionName,
            input: finalFailure.input,
            args: finalFailure.args,
            modulePath: options.modulePath,
            propertiesPath: options.propertiesPath,
            check: finalFailure.check
          }) ?? buildGenericReproductionSnippet({
            modulePath: options.modulePath,
            functionName: definition.functionName,
            args: finalFailure.args
          })
        : null,
      notes: finalFailure?.check.notes ?? []
    };

    return {
      ...baseReport,
      rerunCommand: buildRerunCommand({
        ...baseReport,
        ...(options.commandPrefix !== undefined ? { commandPrefix: options.commandPrefix } : {})
      })
    };
  });

  return {
    title: suite.title,
    description: suite.description ?? "",
    modulePath: options.modulePath,
    propertiesPath: options.propertiesPath,
    generatedAt: new Date().toISOString(),
    cases
  };
}
