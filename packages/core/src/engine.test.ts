import { describe, expect, it } from "vitest";
import { defineProperties, fc, runPropertySuite } from "./index.js";

describe("runPropertySuite", () => {
  it("captures a failing minimal counterexample with rerun metadata", () => {
    const targetModule = {
      chunk(values: number[], size: number): number[][] {
        const chunks: number[][] = [];
        for (let index = 0; index + size <= values.length; index += size) {
          chunks.push(values.slice(index, index + size));
        }
        return chunks;
      }
    };

    const suite = defineProperties({
      title: "Chunk suite",
      properties: [
        {
          id: "chunk-preserves-values",
          label: "Chunk preserves all values",
          functionName: "chunk",
          arbitrary: fc.record({
            values: fc.array(fc.integer(), { minLength: 1, maxLength: 6 }),
            size: fc.integer({ min: 1, max: 4 })
          }),
          examples: [
            {
              values: [1, 2, 3],
              size: 2
            }
          ],
          renderInvariant: () => "flatten(chunk(values, size)) should equal values",
          getArgs: (input) => [input.values, input.size],
          run: ({ fn, input }) => {
            const flattened = (fn(input.values, input.size) as number[][]).flat();
            return {
              pass: JSON.stringify(flattened) === JSON.stringify(input.values),
              expected: input.values,
              actual: flattened,
              actualLabel: "Flattened chunks"
            };
          }
        }
      ]
    });

    const report = runPropertySuite(targetModule, suite, {
      modulePath: "/tmp/chunk.ts",
      propertiesPath: "/tmp/chunk.properties.ts",
      seed: 12,
      numRuns: 50
    });

    expect(report.cases).toHaveLength(1);
    expect(report.cases[0]?.status).toBe("fail");
    expect(report.cases[0]?.counterexamplePath).not.toBeNull();
    expect(report.cases[0]?.rerunCommand).toContain("--seed 12");
    expect(report.cases[0]?.shrinkTrace.length).toBeGreaterThan(0);
  });

  it("records passing cases cleanly", () => {
    const targetModule = {
      clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
      }
    };

    const suite = defineProperties({
      title: "Clamp suite",
      properties: [
        {
          id: "clamp-range",
          label: "Clamp stays in range",
          functionName: "clamp",
          arbitrary: fc.record({
            value: fc.integer(),
            min: fc.integer({ min: -10, max: 0 }),
            max: fc.integer({ min: 1, max: 10 })
          }),
          renderInvariant: () => "Result must stay inside the provided range",
          getArgs: (input) => [input.value, input.min, input.max],
          run: ({ fn, input }) => {
            const actual = fn(input.value, input.min, input.max) as number;
            return {
              pass: actual >= input.min && actual <= input.max,
              expected: {
                min: input.min,
                max: input.max
              },
              actual
            };
          }
        }
      ]
    });

    const report = runPropertySuite(targetModule, suite, {
      modulePath: "/tmp/clamp.ts",
      propertiesPath: "/tmp/clamp.properties.ts",
      seed: 99,
      numRuns: 30
    });

    expect(report.cases[0]?.status).toBe("pass");
    expect(report.cases[0]?.expected).toBeNull();
    expect(report.cases[0]?.reproductionSnippet).toBeNull();
  });
});
