import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SuiteRunReport } from "@counterexample-studio/core";
import { startStudioServer } from "./server.js";

const server = startStudioServer({ port: 0 });
let baseUrl = "";
beforeAll(async () => { if (!server.listening) await once(server, "listening"); baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

async function post(route: string, body: unknown) {
  return fetch(`${baseUrl}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("local Studio API", () => {
  it("produces and replays real reports through the public HTTP routes", async () => {
    const response = await post("/api/run/example", { exampleId: "chunk-buggy", seed: 87492311, runs: 350 });
    expect(response.status).toBe(200);
    const { report } = await response.json() as { report: SuiteRunReport };
    const entry = report.cases[0]!;
    const replayResponse = await post("/api/run/local", { modulePath: entry.modulePath, propertyPath: entry.propertiesPath, exportName: entry.functionName, caseId: entry.id, seed: entry.seed, runs: entry.requestedRuns, path: entry.counterexamplePath });
    expect(replayResponse.status).toBe(200);
    const replay = await replayResponse.json() as { report: SuiteRunReport };
    expect(replay.report.cases[0]?.failingInput).toEqual(entry.failingInput);
    expect(replay.report.cases[0]?.actual).toEqual(entry.actual);
  });

  it("rejects incomplete replay requests before running files", async () => {
    const response = await post("/api/run/local", { modulePath: "missing.ts", propertyPath: "missing.properties.ts", path: "0:0" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("saved property ID and seed") });
  });

  it("returns a useful JSON error for malformed request bodies", async () => {
    const response = await fetch(`${baseUrl}/api/run/local`, { method: "POST", body: "{" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Request body must be valid JSON." });
  });
});
