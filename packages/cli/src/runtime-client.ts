import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SuiteRunReport } from "@counterexample-studio/core";

export interface RuntimeWorkerRequest {
  readonly modulePath: string;
  readonly propertiesPath: string;
  readonly exportName?: string;
  readonly caseId?: string;
  readonly seed?: number;
  readonly path?: string;
  readonly numRuns?: number;
}

interface RuntimeWorkerResponse {
  readonly ok: boolean;
  readonly report?: SuiteRunReport;
  readonly error?: string;
}

const require = createRequire(import.meta.url);
const tsxLoaderPath = require.resolve("tsx");
const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);
const workerPath = resolve(
  currentDirectory,
  currentFile.endsWith(".ts") ? "./runtime-worker.ts" : "./runtime-worker.js"
);

export async function runRuntimeWorker(request: RuntimeWorkerRequest, timeoutMs = 30_000): Promise<SuiteRunReport> {
  const child = spawn(process.execPath, ["--import", tsxLoaderPath, workerPath], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  child.stdin.write(JSON.stringify(request));
  child.stdin.end();

  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
  let exitCode: number;
  try {
    exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
      child.on("error", rejectPromise);
      child.on("close", (code) => resolvePromise(code ?? 1));
    });
  } finally { clearTimeout(timeout); }
  if (timedOut) throw new Error(`Execution stopped after ${timeoutMs / 1000} seconds. Check for an infinite loop or reduce the sampling budget, then retry with the same seed.`);

  const response = JSON.parse(stdout || "{}") as RuntimeWorkerResponse;

  if (exitCode !== 0 || !response.ok || !response.report) {
    throw new Error((response.error ?? stderr) || "Runtime worker failed");
  }

  return response.report;
}
