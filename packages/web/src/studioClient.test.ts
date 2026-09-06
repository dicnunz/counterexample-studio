import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createStudioClient, replayRequest } from "./studioClient";
import { parseReportJson } from "./reportIO";

const report = parseReportJson(readFileSync(new URL("../../../reports/chunk-buggy-chunk-preserves-values.json", import.meta.url), "utf8"));
const entry = report.cases[0]!;
const client = createStudioClient();

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("studio client", () => {
  it("retains every suite case and raw trace without inventing output", async () => {
    const suite = { ...report, cases: [{ ...entry, id: "another" }, entry] };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ report: suite }) })));
    const result = await client.runLocalPath({ modulePath: "target.ts", propertyPath: "property.ts", exportName: "", seed: 42, runs: 200 });
    expect(result.report).toEqual(suite);
    expect(result.report.cases).toHaveLength(2);
    expect(result.report.cases[0]?.searchTrace[0]).not.toHaveProperty("actual");
  });

  it("replays structured metadata with original budget, export, case, seed, and path", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ report }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await client.replayCase({ ...entry, requestedRuns: 350, rerunCommand: "DO NOT EXECUTE THIS" }, { modulePath: "./moved/target.ts", propertyPath: "./moved/property.ts" });
    const request = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(request).toEqual({ modulePath: "./moved/target.ts", propertyPath: "./moved/property.ts", exportName: "chunk", caseId: entry.id, seed: entry.seed, runs: 350, path: "0:0:0" });
    expect(JSON.stringify(request)).not.toContain("DO NOT EXECUTE");
  });

  it("uses an explicit legacy fallback and omits a path for passing cases", () => {
    expect(replayRequest(entry).runs).toBe(100);
    const request = replayRequest({ ...entry, status: "pass", counterexamplePath: null, numRuns: 275 });
    expect(request.runs).toBe(275);
    expect(request).not.toHaveProperty("path");
  });

  it.each(["example", "local"])("propagates actionable errors for %s runs", async (mode) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "Missing property export" }) })));
    const request = mode === "example" ? client.runBundledExample({ exampleId: "chunk-buggy", seed: 1, runs: 100 }) : client.runLocalPath({ modulePath: "x", propertyPath: "y", exportName: "", seed: 1, runs: 100 });
    await expect(request).rejects.toThrow("Missing property export");
  });

  it("turns transport errors into a recovery action", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(client.listBundledExamples()).rejects.toThrow("Start npm run studio -- ui");
  });

  it("handles non-JSON server failures and malformed successful reports", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502, statusText: "Bad Gateway", json: async () => { throw new Error("HTML"); } })));
    await expect(client.listBundledExamples()).rejects.toThrow("502 Bad Gateway");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ report: { cases: [] } }) })));
    await expect(client.runBundledExample({ exampleId: "chunk-buggy", seed: 1, runs: 100 })).rejects.toThrow("Invalid report");
  });
});
