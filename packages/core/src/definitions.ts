import type { Arbitrary } from "fast-check";

export interface IntegerCaseConstraints {
  readonly min?: number;
  readonly max?: number;
}

export interface DoubleCaseConstraints {
  readonly min?: number;
  readonly max?: number;
  readonly noNaN?: boolean;
  readonly noDefaultInfinity?: boolean;
}

export interface StringCaseConstraints {
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface ArrayCaseConstraints {
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface BooleanCaseSource {
  readonly kind: "boolean";
}

export interface IntegerCaseSource {
  readonly kind: "integer";
  readonly constraints?: IntegerCaseConstraints;
}

export interface DoubleCaseSource {
  readonly kind: "double";
  readonly constraints?: DoubleCaseConstraints;
}

export interface StringCaseSource {
  readonly kind: "string";
  readonly constraints?: StringCaseConstraints;
}

export interface ConstantCaseSource<TValue> {
  readonly kind: "constant";
  readonly value: TValue;
}

export interface ConstantFromCaseSource<TValue> {
  readonly kind: "constant-from";
  readonly values: readonly TValue[];
}

export interface ArrayCaseSource<TValue> {
  readonly kind: "array";
  readonly item: CaseSource<TValue>;
  readonly constraints?: ArrayCaseConstraints;
}

export interface TupleCaseSource<TValues extends readonly unknown[]> {
  readonly kind: "tuple";
  readonly items: { readonly [TIndex in keyof TValues]: CaseSource<TValues[TIndex]> };
}

export interface RecordCaseSource<TShape extends Record<string, unknown>> {
  readonly kind: "record";
  readonly fields: { readonly [TKey in keyof TShape]: CaseSource<TShape[TKey]> };
}

export interface OneOfCaseSource<TValue> {
  readonly kind: "one-of";
  readonly variants: readonly CaseSource<TValue>[];
}

export interface FastCheckCaseSource<TValue> {
  readonly kind: "fast-check";
  readonly arbitrary: Arbitrary<TValue>;
  readonly description?: string;
}

export type CaseSource<TValue> =
  | BooleanCaseSource
  | IntegerCaseSource
  | DoubleCaseSource
  | StringCaseSource
  | ConstantCaseSource<TValue>
  | ConstantFromCaseSource<TValue>
  | ArrayCaseSource<unknown>
  | TupleCaseSource<readonly unknown[]>
  | RecordCaseSource<Record<string, unknown>>
  | OneOfCaseSource<TValue>
  | FastCheckCaseSource<TValue>;

export interface PropertyCheckContext<TArgs extends readonly unknown[] = readonly unknown[], TResult = unknown> {
  readonly args: Readonly<TArgs>;
  readonly actual: TResult;
  readonly target: (...args: TArgs) => TResult;
  readonly moduleExports: Record<string, unknown>;
}

export interface PropertyCheckResult {
  readonly pass: boolean;
  readonly message?: string;
  readonly actual?: unknown;
  readonly actualLabel?: string;
  readonly expected?: unknown;
  readonly expectedLabel?: string;
  readonly details?: Record<string, unknown>;
}

export type PropertyCheckReturn = boolean | PropertyCheckResult | void;

export interface PropertyDefinition<TArgs extends readonly unknown[] = readonly unknown[], TResult = unknown> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly target: string;
  readonly invariant: string;
  readonly cases: CaseSource<TArgs>;
  readonly numRuns?: number;
  readonly examples?: readonly TArgs[];
  readonly check: (context: PropertyCheckContext<TArgs, TResult>) => PropertyCheckReturn;
}

export interface PropertySuiteDefinition<
  TProperties extends readonly PropertyDefinition[] = readonly PropertyDefinition[]
> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly targetModule?: string;
  readonly properties: TProperties;
}

export function definePropertySuite<
  TProperties extends readonly PropertyDefinition[]
>(suite: PropertySuiteDefinition<TProperties>): PropertySuiteDefinition<TProperties> {
  return suite;
}

export function defineProperty<TArgs extends readonly unknown[], TResult>(
  property: PropertyDefinition<TArgs, TResult>
): PropertyDefinition<TArgs, TResult> {
  return property;
}

export function passInvariant(): PropertyCheckResult {
  return { pass: true };
}

export function failInvariant(details: Omit<PropertyCheckResult, "pass"> = {}): PropertyCheckResult {
  return {
    pass: false,
    ...details
  };
}

export function boolean(): BooleanCaseSource {
  return { kind: "boolean" };
}

export function integer(constraints: IntegerCaseConstraints = {}): IntegerCaseSource {
  return {
    kind: "integer",
    constraints
  };
}

export function double(constraints: DoubleCaseConstraints = {}): DoubleCaseSource {
  return {
    kind: "double",
    constraints
  };
}

export function string(constraints: StringCaseConstraints = {}): StringCaseSource {
  return {
    kind: "string",
    constraints
  };
}

export function constant<TValue>(value: TValue): ConstantCaseSource<TValue> {
  return {
    kind: "constant",
    value
  };
}

export function constantFrom<const TValues extends readonly [unknown, ...unknown[]]>(
  ...values: TValues
): ConstantFromCaseSource<TValues[number]> {
  return {
    kind: "constant-from",
    values
  };
}

export function array<TValue>(
  item: CaseSource<TValue>,
  constraints: ArrayCaseConstraints = {}
): ArrayCaseSource<TValue> {
  return {
    kind: "array",
    item,
    constraints
  };
}

export function tuple<const TValues extends readonly unknown[]>(
  ...items: { readonly [TIndex in keyof TValues]: CaseSource<TValues[TIndex]> }
): TupleCaseSource<TValues> {
  return {
    kind: "tuple",
    items
  };
}

export function record<TShape extends Record<string, unknown>>(
  fields: { readonly [TKey in keyof TShape]: CaseSource<TShape[TKey]> }
): RecordCaseSource<TShape> {
  return {
    kind: "record",
    fields
  };
}

export function oneOf<TValue>(
  ...variants: readonly [CaseSource<TValue>, ...CaseSource<TValue>[]]
): OneOfCaseSource<TValue> {
  return {
    kind: "one-of",
    variants
  };
}

export function fromFastCheck<TValue>(
  arbitrary: Arbitrary<TValue>,
  description?: string
): FastCheckCaseSource<TValue> {
  return description === undefined
    ? {
        kind: "fast-check",
        arbitrary
      }
    : {
        kind: "fast-check",
        arbitrary,
        description
      };
}
