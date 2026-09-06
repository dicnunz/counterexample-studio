import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_REPORT_BYTES, parseReportJson, preferredCase, serializeReport, validateSuiteReport } from "./reportIO";

const failure = readFileSync(new URL("../../../reports/chunk-buggy-chunk-preserves-values.json", import.meta.url), "utf8");
const passing = readFileSync(new URL("../../../reports/chunk-fixed-chunk-preserves-values.json", import.meta.url), "utf8");

describe("portable reports", () => {
  it.each([failure, passing])("round-trips an actual CLI report without losing information", (source) => {
    const report = parseReportJson(source);
    expect(JSON.parse(serializeReport(report))).toEqual(JSON.parse(source));
  });

  it("selects the later failure without discarding the passing case", () => {
    const fail = parseReportJson(failure), pass = parseReportJson(passing);
    const suite = validateSuiteReport({ ...fail, cases: [{ ...pass.cases[0], id: "pass-first" }, fail.cases[0]] });
    expect(preferredCase(suite).status).toBe("fail");
    expect(suite.cases).toHaveLength(2);
  });

  it("rejects malformed JSON, oversized files, and empty suites with useful messages", () => {
    expect(() => parseReportJson("{" )).toThrow("not valid JSON");
    expect(() => parseReportJson(" ".repeat(MAX_REPORT_BYTES + 1))).toThrow("exceeds 5 MB");
    expect(() => validateSuiteReport({ ...JSON.parse(failure), cases: [] })).toThrow("cases must be a nonempty array");
  });

  it.each([
    ["seed", "42", "seed"],
    ["numRuns", -1, "numRuns"],
    ["requestedRuns", 0, "requestedRuns"],
    ["counterexamplePath", "0; execute", "counterexamplePath"],
    ["actual", { value: { preview: "x" } }, "actual.label"],
    ["notes", null, "notes"],
    ["shrinkTrace", [{ step: "one" }], "step"]
  ])("rejects invalid %s metadata", (field, value, label) => {
    const report = JSON.parse(failure);
    report.cases[0][field] = value;
    expect(() => validateSuiteReport(report)).toThrow(String(label));
  });

  it("rejects duplicate IDs and malformed nested search nodes", () => {
    const report = JSON.parse(failure);
    report.cases.push(report.cases[0]);
    expect(() => validateSuiteReport(report)).toThrow("unique");
    report.cases.pop();
    report.cases[0].searchTrace[0].children[0].value.preview = 4;
    expect(() => validateSuiteReport(report)).toThrow("preview must be a string");
  });

  it("rejects deeply nested values before the renderer or exporter can overflow", () => {
    const report = JSON.parse(failure);
    let value: unknown = 0;
    for (let i = 0; i < 110; i++) value = [value];
    report.cases[0].actual.value.json = value;
    expect(() => validateSuiteReport(report)).toThrow("100 nesting levels");
    report.cases[0].actual.value.json = Infinity;
    expect(() => validateSuiteReport(report)).toThrow("finite numbers");
  });
});
