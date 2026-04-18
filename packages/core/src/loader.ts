import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { PropertyDefinition, PropertySuiteDefinition } from "./definitions.js";
import { CounterexampleStudioUsageError } from "./errors.js";

export interface LoadedPropertySuite {
  readonly filePath: string;
  readonly suite: PropertySuiteDefinition;
}

export interface LoadedTargetModule {
  readonly filePath: string;
  readonly exports: Record<string, unknown>;
}

export async function loadPropertySuite(filePath: string): Promise<LoadedPropertySuite> {
  const resolvedPath = path.resolve(filePath);
  const moduleExports = await importLocalModule(resolvedPath);
  const suiteCandidate = selectSuiteExport(moduleExports);
  validateSuiteDefinition(suiteCandidate, resolvedPath);

  return {
    filePath: resolvedPath,
    suite: suiteCandidate
  };
}

export async function loadTargetModule(filePath: string): Promise<LoadedTargetModule> {
  const resolvedPath = path.resolve(filePath);
  const moduleExports = normalizeTargetModuleExports(await importLocalModule(resolvedPath));

  return {
    filePath: resolvedPath,
    exports: moduleExports
  };
}

export function resolveSuiteTargetModulePath(
  loadedSuite: LoadedPropertySuite,
  overridePath?: string
): string {
  if (overridePath) {
    return path.resolve(overridePath);
  }

  if (!loadedSuite.suite.targetModule) {
    throw new CounterexampleStudioUsageError(
      `Suite "${loadedSuite.suite.id}" does not declare targetModule and no --module path was provided.`
    );
  }

  return path.resolve(path.dirname(loadedSuite.filePath), loadedSuite.suite.targetModule);
}

async function importLocalModule(resolvedPath: string): Promise<Record<string, unknown>> {
  const { tsImport } = await import("tsx/esm/api");
  const moduleUrl = await buildCacheSafeModuleUrl(resolvedPath);
  const imported = await tsImport(moduleUrl, {
    parentURL: pathToFileURL(`${process.cwd()}${path.sep}`).href
  });
  return imported as Record<string, unknown>;
}

async function buildCacheSafeModuleUrl(resolvedPath: string): Promise<string> {
  const fileUrl = pathToFileURL(resolvedPath);
  const fileStats = await stat(resolvedPath);
  fileUrl.searchParams.set("counterexampleStudioMtime", String(Math.floor(fileStats.mtimeMs)));
  fileUrl.searchParams.set("counterexampleStudioSize", String(fileStats.size));
  return fileUrl.href;
}

function selectSuiteExport(moduleExports: Record<string, unknown>): unknown {
  if ("default" in moduleExports) {
    return unwrapDefaultExport(moduleExports.default);
  }

  if ("suite" in moduleExports) {
    return moduleExports.suite;
  }

  throw new CounterexampleStudioUsageError(
    'Property definition module must export a suite as the default export or as a named export called "suite".'
  );
}

function unwrapDefaultExport(candidate: unknown): unknown {
  let current = candidate;
  while (isPlainObject(current) && "default" in current && Object.keys(current).every((key) => key === "default" || key === "__esModule")) {
    current = current.default;
  }
  return current;
}

function normalizeTargetModuleExports(moduleExports: Record<string, unknown>): Record<string, unknown> {
  const defaultExport = unwrapDefaultExport("default" in moduleExports ? moduleExports.default : undefined);
  if (!isPlainObject(defaultExport)) {
    return moduleExports;
  }

  return {
    ...defaultExport,
    ...moduleExports
  };
}

function validateSuiteDefinition(candidate: unknown, filePath: string): asserts candidate is PropertySuiteDefinition {
  if (!isPlainObject(candidate)) {
    throw new CounterexampleStudioUsageError(`Property suite at ${filePath} must export an object.`);
  }

  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    throw new CounterexampleStudioUsageError(`Property suite at ${filePath} must include a non-empty string id.`);
  }

  if (typeof candidate.title !== "string" || candidate.title.length === 0) {
    throw new CounterexampleStudioUsageError(`Property suite "${candidate.id}" must include a non-empty string title.`);
  }

  if ("targetModule" in candidate && candidate.targetModule !== undefined && typeof candidate.targetModule !== "string") {
    throw new CounterexampleStudioUsageError(`Property suite "${candidate.id}" has a non-string targetModule.`);
  }

  if (!Array.isArray(candidate.properties) || candidate.properties.length === 0) {
    throw new CounterexampleStudioUsageError(`Property suite "${candidate.id}" must include at least one property.`);
  }

  const seenPropertyIds = new Set<string>();
  for (const property of candidate.properties) {
    validatePropertyDefinition(property, candidate.id);
    if (seenPropertyIds.has(property.id)) {
      throw new CounterexampleStudioUsageError(
        `Property suite "${candidate.id}" has a duplicate property id "${property.id}".`
      );
    }
    seenPropertyIds.add(property.id);
  }
}

function validatePropertyDefinition(candidate: unknown, suiteId: string): asserts candidate is PropertyDefinition {
  if (!isPlainObject(candidate)) {
    throw new CounterexampleStudioUsageError(`Property entries in suite "${suiteId}" must be objects.`);
  }

  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    throw new CounterexampleStudioUsageError(`A property in suite "${suiteId}" is missing a non-empty string id.`);
  }

  if (typeof candidate.title !== "string" || candidate.title.length === 0) {
    throw new CounterexampleStudioUsageError(`Property "${candidate.id}" in suite "${suiteId}" is missing a title.`);
  }

  if (typeof candidate.target !== "string" || candidate.target.length === 0) {
    throw new CounterexampleStudioUsageError(
      `Property "${candidate.id}" in suite "${suiteId}" is missing a target export name.`
    );
  }

  if (typeof candidate.invariant !== "string" || candidate.invariant.length === 0) {
    throw new CounterexampleStudioUsageError(
      `Property "${candidate.id}" in suite "${suiteId}" must declare a non-empty invariant string.`
    );
  }

  if (!("cases" in candidate)) {
    throw new CounterexampleStudioUsageError(`Property "${candidate.id}" in suite "${suiteId}" is missing cases.`);
  }

  if (typeof candidate.check !== "function") {
    throw new CounterexampleStudioUsageError(
      `Property "${candidate.id}" in suite "${suiteId}" must include a synchronous check function.`
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
