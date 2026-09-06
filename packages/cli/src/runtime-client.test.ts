import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findExample } from "@counterexample-studio/examples";
import { runRuntimeWorker } from "./runtime-client.js";

describe("runtime worker reproduction", () => {
  it("replays the real minimal witness through the isolated JS/TS worker", async () => {
    const example = findExample("chunk-buggy");
    const request = { modulePath: example.modulePath, propertiesPath: example.propertiesPath, exportName: example.exportName, seed: example.defaultSeed, numRuns: 350 };
    const first = (await runRuntimeWorker(request)).cases[0]!;
    const replay = (await runRuntimeWorker({ ...request, caseId: first.id, path: first.counterexamplePath! })).cases[0]!;
    expect(first.requestedRuns).toBe(350);
    expect(first.rerunCommand).toContain("--runs 350");
    expect(replay.status).toBe("fail");
    expect(replay.failingInput).toEqual(first.failingInput);
    expect(replay.actual).toEqual(first.actual);
  });

  it("terminates a non-returning target with an actionable error", async () => {
    const directory = await mkdtemp(join(tmpdir(), "counterexample-timeout-"));
    const modulePath = join(directory, "target.mjs");
    const propertiesPath = join(directory, "properties.mjs");
    const core = new URL("../../core/dist/index.js", import.meta.url).href;
    try {
      await writeFile(modulePath, "export const forever = () => { while (true) {} };\n");
      await writeFile(propertiesPath, `import { fc } from ${JSON.stringify(core)}; export default { title: 'Timeout test', properties: [{ id: 'forever', label: 'Must return', functionName: 'forever', arbitrary: fc.constant(0), getArgs: () => [], renderInvariant: () => 'returns', run: ({ fn }) => ({ pass: true, expected: 0, actual: fn() }) }] };`);
      await expect(runRuntimeWorker({ modulePath, propertiesPath, seed: 1, numRuns: 1 }, 1500)).rejects.toThrow("Execution stopped after 1.5 seconds");
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
