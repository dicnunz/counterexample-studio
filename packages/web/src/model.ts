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
