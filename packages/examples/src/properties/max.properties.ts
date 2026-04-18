import { defineProperties, fc } from "@counterexample-studio/core";

interface MaxModule {
  readonly maxOf: (values: readonly number[]) => number;
}

export default defineProperties<MaxModule>({
  title: "Max belongs to the input",
  description: "A correct max implementation should never invent a value that was not in the original array.",
  properties: [
    {
      id: "max-belongs-to-input",
      label: "Max result belongs to the source array",
      functionName: "maxOf",
      arbitrary: fc.record({
        values: fc.array(fc.integer({ min: -20, max: 20 }), { minLength: 1, maxLength: 8 })
      }),
      examples: [
        {
          values: [-1]
        }
      ],
      renderInvariant: () => "maxOf(values) should be one of the input values and not less than any of them",
      getArgs: (input) => [input.values],
      run: ({ fn, input }) => {
        const actual = fn(input.values);
        return {
          pass:
            input.values.includes(actual) &&
            input.values.every((value: number) => actual >= value),
          expected: {
            belongsToInput: true,
            lowerBound: Math.max(...input.values)
          },
          actual,
          expectedLabel: "Expected max contract",
          actualLabel: "Returned max"
        };
      }
    }
  ]
});
