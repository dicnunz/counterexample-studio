import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { runPropertySuite } from "@counterexample-studio/core";
import type { PropertySuite, SuiteRunReport } from "@counterexample-studio/core";

export interface ExampleCatalogEntry {
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
  readonly walkthrough?: boolean;
}

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const sourceExtension = currentFile.endsWith(".ts") ? ".ts" : ".js";

function artifact(relativeStem: string): string {
  return resolve(currentDirectory, `${relativeStem}${sourceExtension}`);
}

function createPair(config: {
  readonly family: string;
  readonly title: string;
  readonly description: string;
  readonly exportName: string;
  readonly propertyName: string;
  readonly propertySummary: string;
  readonly invariantLabel: string;
  readonly tags: readonly string[];
  readonly highlights: readonly string[];
  readonly defaultSeed: number;
  readonly defaultRuns: number;
  readonly propertiesStem: string;
  readonly moduleStem: string;
  readonly walkthrough?: boolean;
}): ExampleCatalogEntry[] {
  return [
    {
      id: `${config.family}-buggy`,
      family: config.family,
      title: `${config.title} (buggy)`,
      description: config.description,
      exportName: config.exportName,
      propertyName: config.propertyName,
      propertySummary: config.propertySummary,
      invariantLabel: config.invariantLabel,
      version: "buggy",
      expectedOutcome: "fail",
      tags: config.tags,
      highlights: config.highlights,
      defaultSeed: config.defaultSeed,
      defaultRuns: config.defaultRuns,
      modulePath: artifact(`./modules/${config.moduleStem}-buggy`),
      propertiesPath: artifact(`./properties/${config.propertiesStem}`),
      ...(config.walkthrough ? { walkthrough: true } : {})
    },
    {
      id: `${config.family}-fixed`,
      family: config.family,
      title: `${config.title} (fixed)`,
      description: config.description,
      exportName: config.exportName,
      propertyName: config.propertyName,
      propertySummary: config.propertySummary,
      invariantLabel: config.invariantLabel,
      version: "fixed",
      expectedOutcome: "pass",
      tags: config.tags,
      highlights: config.highlights,
      defaultSeed: config.defaultSeed,
      defaultRuns: config.defaultRuns,
      modulePath: artifact(`./modules/${config.moduleStem}-fixed`),
      propertiesPath: artifact(`./properties/${config.propertiesStem}`),
      ...(config.walkthrough ? { walkthrough: true } : {})
    }
  ];
}

export const exampleCatalog: readonly ExampleCatalogEntry[] = [
  ...createPair({
    family: "chunk",
    title: "Chunk preserves values",
    description: "Shows how a small tail-dropping bug shrinks down to a tight array/size pair.",
    exportName: "chunk",
    propertyName: "chunk-preserves-values",
    propertySummary: "Flattening the produced chunks should reproduce the original list.",
    invariantLabel: "flatten(chunk(values, size)) should equal the original values",
    tags: ["arrays", "walkthrough", "small witness"],
    highlights: [
      "Shrinks from the seeded [1,2,3] / 2 example down to the minimal witness [0] / 2.",
      "Makes the failing input, actual flattened output, and shrink path obvious at a glance."
    ],
    defaultSeed: 87492311,
    defaultRuns: 100,
    propertiesStem: "chunk.properties",
    moduleStem: "chunk",
    walkthrough: true
  }),
  ...createPair({
    family: "max",
    title: "Max belongs to the input",
    description: "Catches the classic zero-seeded max bug on all-negative arrays.",
    exportName: "maxOf",
    propertyName: "max-belongs-to-input",
    propertySummary: "The reported max must be drawn from the input and dominate every source value.",
    invariantLabel: "maxOf(values) should be one of the input values and not less than any of them",
    tags: ["numbers", "reference contract"],
    highlights: [
      "A single negative value is enough to expose the zero-seeded bug.",
      "The paired fixed variant uses the same property and deterministic seed."
    ],
    defaultSeed: 99131,
    defaultRuns: 120,
    propertiesStem: "max.properties",
    moduleStem: "max"
  }),
  ...createPair({
    family: "interleave",
    title: "Interleave keeps both tails",
    description: "Demonstrates a zipper implementation that silently truncates the longer input.",
    exportName: "interleave",
    propertyName: "interleave-preserves-tail",
    propertySummary: "Interleave should preserve leftover items instead of truncating to the shorter input.",
    invariantLabel: "interleave(left, right) should match the reference zipper with tails preserved",
    tags: ["arrays", "ordering"],
    highlights: [
      "A single leftover item is enough to produce the counterexample.",
      "The trace makes truncation bugs easy to explain in code review."
    ],
    defaultSeed: 7712,
    defaultRuns: 100,
    propertiesStem: "interleave.properties",
    moduleStem: "interleave"
  }),
  ...createPair({
    family: "rotate-left",
    title: "Rotate left respects full turns",
    description: "Highlights an off-by-one modulo bug that only shows up on exact full rotations.",
    exportName: "rotateLeft",
    propertyName: "rotate-left-reference",
    propertySummary: "Full rotations should land on the original array rather than a shifted variant.",
    invariantLabel: "rotateLeft(values, steps) should match a modulo-by-length reference rotation",
    tags: ["arrays", "modulo"],
    highlights: [
      "The minimal witness is tiny: two items and a full turn.",
      "Useful for showing why modulo-by-length matters in otherwise correct code."
    ],
    defaultSeed: 31008,
    defaultRuns: 100,
    propertiesStem: "rotate-left.properties",
    moduleStem: "rotate-left"
  }),
  ...createPair({
    family: "binary-search",
    title: "Binary search finds present values",
    description: "Proves that a supposedly sorted lookup still misses values at the lowest depth.",
    exportName: "binarySearch",
    propertyName: "binary-search-finds-present-value",
    propertySummary: "If the target exists in the sorted array, the returned index must point at it.",
    invariantLabel: "binarySearch(values, target) should point at the present target",
    tags: ["search", "sorted data"],
    highlights: [
      "Collapses to a one-element array with a missed left-edge target.",
      "A sharp example for deterministic reruns and seed-based comparison."
    ],
    defaultSeed: 4881,
    defaultRuns: 120,
    propertiesStem: "binary-search.properties",
    moduleStem: "binary-search"
  }),
  ...createPair({
    family: "merge-ranges",
    title: "Merge touching ranges",
    description: "Finds the interval-merging edge case where touching ranges are left split apart.",
    exportName: "mergeRanges",
    propertyName: "merge-ranges-canonical",
    propertySummary: "Touching and overlapping ranges should collapse to the same canonical merge.",
    invariantLabel: "mergeRanges(ranges) should match the canonical merge for touching and overlapping intervals",
    tags: ["intervals", "canonicalization"],
    highlights: [
      "The minimal witness is two touching intervals that should collapse into one.",
      "Shows that rejection steps matter when explaining why the final witness is minimal."
    ],
    defaultSeed: 16384,
    defaultRuns: 90,
    propertiesStem: "merge-ranges.properties",
    moduleStem: "merge-ranges"
  })
] as const;

export async function loadExample(entry: ExampleCatalogEntry): Promise<SuiteRunReport> {
  const targetModule = await import(`${pathToFileURL(entry.modulePath).href}?ts=${Date.now()}`);
  const propertyModule = await import(`${pathToFileURL(entry.propertiesPath).href}?ts=${Date.now()}`);
  const suite = (propertyModule.default ?? propertyModule.suite ?? propertyModule) as PropertySuite<Record<string, unknown>>;
  return runPropertySuite(targetModule, suite, {
    modulePath: entry.modulePath,
    propertiesPath: entry.propertiesPath,
    seed: entry.defaultSeed,
    numRuns: entry.defaultRuns
  });
}

export function findExample(id: string): ExampleCatalogEntry {
  const match = exampleCatalog.find((entry) => entry.id === id);
  if (!match) {
    throw new Error(`Unknown bundled example "${id}"`);
  }
  return match;
}
