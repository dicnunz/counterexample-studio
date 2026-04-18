import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runPropertySuite } from "@counterexample-studio/core";
import type { PropertySuite } from "@counterexample-studio/core";

interface RuntimeWorkerRequest {
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
  readonly report?: ReturnType<typeof runPropertySuite>;
  readonly error?: string;
}

function overrideExportName<TModule>(suite: PropertySuite<TModule>, exportName: string): PropertySuite<TModule> {
  return {
    ...suite,
    properties: suite.properties.map((property) => ({
      ...property,
      functionName: exportName as never
    }))
  };
}

async function importFresh(path: string): Promise<Record<string, unknown>> {
  const absolutePath = resolve(path);
  return import(`${pathToFileURL(absolutePath).href}?ts=${Date.now()}`) as Promise<Record<string, unknown>>;
}

async function readRequest(): Promise<RuntimeWorkerRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as RuntimeWorkerRequest;
}

async function main() {
  const request = await readRequest();
  const targetModule = await importFresh(request.modulePath);
  const suiteModule = await importFresh(request.propertiesPath);
  const suite = (suiteModule.default ?? suiteModule.suite ?? suiteModule) as PropertySuite<Record<string, unknown>>;
  const finalSuite = request.exportName ? overrideExportName(suite, request.exportName) : suite;
  const runOptions = {
    modulePath: resolve(request.modulePath),
    propertiesPath: resolve(request.propertiesPath),
    commandPrefix: "npm run studio -- run",
    ...(request.caseId !== undefined ? { caseId: request.caseId } : {}),
    ...(request.seed !== undefined ? { seed: request.seed } : {}),
    ...(request.path !== undefined ? { path: request.path } : {}),
    ...(request.numRuns !== undefined ? { numRuns: request.numRuns } : {})
  };
  const report = runPropertySuite(targetModule, finalSuite, runOptions);

  const response: RuntimeWorkerResponse = {
    ok: true,
    report
  };
  process.stdout.write(JSON.stringify(response));
}

void main().catch((error) => {
  const response: RuntimeWorkerResponse = {
    ok: false,
    error: error instanceof Error ? error.stack ?? error.message : String(error)
  };
  process.stdout.write(JSON.stringify(response));
  process.exitCode = 1;
});
