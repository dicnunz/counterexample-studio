import { defineProperties, fc } from "@counterexample-studio/core";

interface BinarySearchModule {
  readonly binarySearch: (values: readonly number[], target: number) => number;
}

export default defineProperties<BinarySearchModule>({
  title: "Binary search finds present values",
  description: "When the target is known to be in the sorted input, a correct binary search should return a valid index.",
  properties: [
    {
      id: "binary-search-finds-present-value",
      label: "Binary search returns a valid index for present values",
      functionName: "binarySearch",
      arbitrary: fc
        .uniqueArray(fc.integer({ min: -12, max: 12 }), { minLength: 1, maxLength: 8 })
        .chain((values) => {
          const sorted = [...values].sort((left, right) => left - right);
          return fc.record({
            values: fc.constant(sorted),
            targetIndex: fc.integer({ min: 0, max: sorted.length - 1 })
          });
        }),
      examples: [
        {
          values: [0],
          targetIndex: 0
        }
      ],
      renderInvariant: () => "binarySearch(values, target) should point at the present target",
      getArgs: (input) => [input.values, input.values[input.targetIndex]],
      run: ({ fn, input }) => {
        const target = input.values[input.targetIndex] as number;
        const actual = fn(input.values, target);
        return {
          pass: actual >= 0 && input.values[actual] === target,
          expected: {
            target,
            oneOf: input.values
          },
          actual,
          expectedLabel: "Expected index contract",
          actualLabel: "Returned index"
        };
      }
    }
  ]
});
