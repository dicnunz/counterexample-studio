import { defineProperties, fc } from "@counterexample-studio/core";
import { flatten } from "../support.js";

interface ChunkModule {
  readonly chunk: (values: readonly number[], size: number) => number[][];
}

export default defineProperties<ChunkModule>({
  title: "Chunk preserves values",
  description: "Flattening chunk output should reproduce the original list without dropping the tail.",
  properties: [
    {
      id: "chunk-preserves-values",
      label: "Chunk preserves all values",
      functionName: "chunk",
      description: "The chunked output should keep every original value in order.",
      arbitrary: fc.record({
        values: fc.array(fc.integer({ min: -9, max: 9 }), { minLength: 1, maxLength: 7 }),
        size: fc.integer({ min: 1, max: 4 })
      }),
      examples: [
        {
          values: [1, 2, 3],
          size: 2
        }
      ],
      renderInvariant: () => "flatten(chunk(values, size)) should equal the original values",
      getArgs: (input) => [input.values, input.size],
      run: ({ fn, input }) => {
        const actual = flatten(fn(input.values, input.size));
        return {
          pass: JSON.stringify(actual) === JSON.stringify(input.values),
          expected: input.values,
          actual,
          expectedLabel: "Original values",
          actualLabel: "Flattened chunks"
        };
      },
      makeReproductionSnippet: ({ modulePath, input }) => [
        `import * as targetModule from ${JSON.stringify(modulePath)};`,
        "",
        `const values = ${JSON.stringify(input.values)};`,
        `const size = ${input.size};`,
        "const actual = targetModule.chunk(values, size).flat();",
        "console.log(actual);"
      ].join("\n")
    }
  ]
});
