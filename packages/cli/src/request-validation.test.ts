import { describe, expect, it } from "vitest";
import { parseExampleRunRequest, parseLocalRunRequest } from "./request-validation.js";

const replay = { modulePath: "./target.ts", propertyPath: "./property.ts", exportName: "subject", caseId: "contract", seed: 123, runs: 350, path: "0:2:1" };

describe("run request validation", () => {
  it("forwards all deterministic replay options to the worker", () => {
    expect(parseLocalRunRequest(replay)).toEqual({ modulePath: "./target.ts", propertiesPath: "./property.ts", exportName: "subject", caseId: "contract", seed: 123, numRuns: 350, path: "0:2:1" });
  });
  it("keeps ordinary local suites and property-defined exports usable", () => {
    expect(parseLocalRunRequest({ modulePath: "target.ts", propertyPath: "property.ts" })).toEqual({ modulePath: "target.ts", propertiesPath: "property.ts" });
  });
  it.each([{ ...replay, caseId: undefined }, { ...replay, seed: undefined }, { ...replay, path: "bad" }])("rejects incomplete replay metadata", (request) => {
    expect(() => parseLocalRunRequest(request)).toThrow(/path|seed/i);
  });
  it.each([0, -1, 1.5, 10001, "100"])("rejects invalid sampling budget %s", (runs) => {
    expect(() => parseLocalRunRequest({ ...replay, runs })).toThrow("Runs");
    expect(() => parseExampleRunRequest({ exampleId: "chunk-buggy", runs })).toThrow("Runs");
  });
});
