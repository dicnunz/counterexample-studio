import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoStudioClient } from "./studioClient";

const client = createDemoStudioClient();

const failingLaterCaseResponse = {
  report: {
    cases: [
      {
        id: "first-pass",
        label: "First property passes",
        description: "First property description",
        functionName: "subjectUnderTest",
        invariant: "first invariant",
        status: "pass",
        seed: 41,
        numRuns: 100,
        numShrinks: 0,
        counterexamplePath: null,
        rerunCommand: "npm run studio -- run --case first-pass",
        modulePath: "./src/subject.ts",
        propertiesPath: "./src/subject.properties.ts",
        failingInput: null,
        inputArguments: null,
        expected: null,
        actual: null,
        shrinkTrace: [],
        searchTrace: [
          {
            status: "success",
            value: {
              json: { candidate: 1 },
              preview: "{\"candidate\":1}"
            },
            children: []
          }
        ],
        reproductionSnippet: null,
        notes: []
      },
      {
        id: "second-fail",
        label: "Second property fails",
        description: "Second property description",
        functionName: "subjectUnderTest",
        invariant: "second invariant",
        status: "fail",
        seed: 42,
        numRuns: 100,
        numShrinks: 2,
        counterexamplePath: "0:0",
        rerunCommand: "npm run studio -- run --case second-fail --seed 42",
        modulePath: "./src/subject.ts",
        propertiesPath: "./src/subject.properties.ts",
        failingInput: {
          json: { value: 1 },
          preview: "{\"value\":1}"
        },
        inputArguments: [
          {
            json: [1],
            preview: "[1]"
          }
        ],
        expected: {
          label: "Expected invariant",
          value: {
            json: "should pass",
            preview: "\"should pass\""
          }
        },
        actual: {
          label: "Actual result",
          value: {
            json: "failed",
            preview: "\"failed\""
          }
        },
        shrinkTrace: [
          {
            step: 0,
            label: "Minimal counterexample",
            input: {
              json: [1],
              preview: "[1]"
            },
            arguments: [
              {
                json: [1],
                preview: "[1]"
              }
            ],
            expected: {
              label: "Expected invariant",
              value: {
                json: "should pass",
                preview: "\"should pass\""
              }
            },
            actual: {
              label: "Actual result",
              value: {
                json: "failed",
                preview: "\"failed\""
              }
            },
            notes: ["Accepted failing shrink."]
          }
        ],
        searchTrace: [
          {
            status: "failure",
            value: {
              json: [1],
              preview: "[1]"
            },
            children: []
          }
        ],
        reproductionSnippet: "console.log('repro');",
        notes: ["Second property note."]
      }
    ]
  }
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createDemoStudioClient", () => {
  it("promotes a later failing case instead of silently keeping the first pass", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => failingLaterCaseResponse
      }))
    );

    const report = await client.runLocalPath({
      modulePath: "./src/subject.ts",
      exportName: "subjectUnderTest",
      propertyPath: "./src/subject.properties.ts",
      seed: 42,
      runs: 100
    });

    expect(report.kind).toBe("fail");
    expect(report.rerunCommand).toBe("npm run studio -- run --case second-fail --seed 42");
    expect(report.property.summary).toBe("Second property description");
    expect(report.notes[0]).toContain("Showing Second property fails");
  });

  it("does not invent actual results for search-trace nodes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => failingLaterCaseResponse
      }))
    );

    const report = await client.runLocalPath({
      modulePath: "./src/subject.ts",
      exportName: "subjectUnderTest",
      propertyPath: "./src/subject.properties.ts",
      seed: 42,
      runs: 100
    });

    expect(report.trace[0]?.phase).toBe("search");
    expect(report.trace[0]?.actual).toBeNull();
    expect(report.trace[report.trace.length - 1]?.phase).toBe("shrink");
    expect(report.trace[report.trace.length - 1]?.actual).toBe("failed");
  });
});
