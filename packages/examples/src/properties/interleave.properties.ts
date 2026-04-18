import { defineProperties, fc } from "@counterexample-studio/core";
import { interleaveReference } from "../support.js";

interface InterleaveModule {
  readonly interleave: (left: readonly number[], right: readonly number[]) => number[];
}

export default defineProperties<InterleaveModule>({
  title: "Interleave keeps both tails",
  description: "Interleave implementations should preserve leftover items instead of truncating to the shortest input.",
  properties: [
    {
      id: "interleave-preserves-tail",
      label: "Interleave preserves trailing items",
      functionName: "interleave",
      arbitrary: fc.record({
        left: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 6 }),
        right: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 6 })
      }),
      examples: [
        {
          left: [1],
          right: []
        }
      ],
      renderInvariant: () => "interleave(left, right) should match the reference zipper with tails preserved",
      getArgs: (input) => [input.left, input.right],
      run: ({ fn, input }) => {
        const actual = fn(input.left, input.right);
        const expected = interleaveReference(input.left, input.right);
        return {
          pass: JSON.stringify(actual) === JSON.stringify(expected),
          expected,
          actual,
          expectedLabel: "Reference interleave",
          actualLabel: "Actual interleave"
        };
      }
    }
  ]
});
