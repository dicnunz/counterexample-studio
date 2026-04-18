import { defineProperties, fc } from "@counterexample-studio/core";
import { mergeRangesReference } from "../support.js";

interface MergeRangesModule {
  readonly mergeRanges: (ranges: readonly { readonly start: number; readonly end: number }[]) => {
    readonly start: number;
    readonly end: number;
  }[];
}

export default defineProperties<MergeRangesModule>({
  title: "Merge touching ranges",
  description: "Touching intervals should collapse into a single merged range instead of remaining split apart.",
  properties: [
    {
      id: "merge-ranges-canonical",
      label: "Merge ranges matches the canonical overlap merge",
      functionName: "mergeRanges",
      arbitrary: fc.array(
        fc.record({
          start: fc.integer({ min: 0, max: 12 }),
          end: fc.integer({ min: 0, max: 12 })
        }),
        { minLength: 1, maxLength: 6 }
      ),
      examples: [
        [
          { start: 1, end: 2 },
          { start: 2, end: 3 }
        ]
      ],
      renderInvariant: () => "mergeRanges(ranges) should match the canonical merge for touching and overlapping intervals",
      getArgs: (input) => [input],
      run: ({ fn, input }) => {
        const actual = fn(input);
        const expected = mergeRangesReference(input);
        return {
          pass: JSON.stringify(actual) === JSON.stringify(expected),
          expected,
          actual,
          expectedLabel: "Canonical merged ranges",
          actualLabel: "Actual merged ranges"
        };
      }
    }
  ]
});
