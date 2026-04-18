import { defineProperties, fc } from "@counterexample-studio/core";
import { rotateLeftReference } from "../support.js";

interface RotateLeftModule {
  readonly rotateLeft: (values: readonly number[], steps: number) => number[];
}

export default defineProperties<RotateLeftModule>({
  title: "Rotate left respects full turns",
  description: "Rotating by any multiple of the array length should land on the original sequence.",
  properties: [
    {
      id: "rotate-left-reference",
      label: "Rotate left matches the reference implementation",
      functionName: "rotateLeft",
      arbitrary: fc.record({
        values: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 7 }),
        steps: fc.integer({ min: 0, max: 20 })
      }),
      examples: [
        {
          values: [1, 2],
          steps: 2
        }
      ],
      renderInvariant: () => "rotateLeft(values, steps) should match a modulo-by-length reference rotation",
      getArgs: (input) => [input.values, input.steps],
      run: ({ fn, input }) => {
        const actual = fn(input.values, input.steps);
        const expected = rotateLeftReference(input.values, input.steps);
        return {
          pass: JSON.stringify(actual) === JSON.stringify(expected),
          expected,
          actual,
          expectedLabel: "Reference rotation",
          actualLabel: "Actual rotation"
        };
      }
    }
  ]
});
