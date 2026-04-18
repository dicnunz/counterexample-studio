import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exampleCatalog, findExample } from "@counterexample-studio/examples";
import type { ExampleCatalogEntry } from "@counterexample-studio/examples";
import type { SuiteRunReport } from "@counterexample-studio/core";
import { runRuntimeWorker } from "./runtime-client.js";

interface StartServerOptions {
  readonly port?: number;
  readonly openBrowser?: boolean;
}

interface LocalRunBody {
  readonly modulePath: string;
  readonly propertyPath: string;
  readonly exportName?: string;
  readonly seed?: number;
  readonly runs?: number;
}

interface ExampleRunBody {
  readonly exampleId: string;
  readonly seed?: number;
  readonly runs?: number;
}

function contentType(path: string): string {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function getWebDistPath(): string {
  return resolve(fileURLToPath(new URL("../../web/dist", import.meta.url)));
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, statusCode: number, message: string): void {
  sendJson(response, statusCode, {
    error: message
  });
}

async function runExample(body: ExampleRunBody): Promise<{ example: ExampleCatalogEntry; report: SuiteRunReport }> {
  const example = findExample(body.exampleId);
  const request = {
    modulePath: example.modulePath,
    propertiesPath: example.propertiesPath,
    exportName: example.exportName,
    seed: body.seed ?? example.defaultSeed,
    numRuns: body.runs ?? example.defaultRuns
  };
  const report = await runRuntimeWorker(request);
  return {
    example,
    report
  };
}

async function serveStatic(response: ServerResponse, pathname: string): Promise<void> {
  const distRoot = getWebDistPath();
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const assetPath = resolve(distRoot, `.${relativePath}`);

  try {
    const file = await readFile(assetPath);
    response.writeHead(200, {
      "content-type": contentType(assetPath)
    });
    response.end(file);
  } catch {
    const indexFile = await readFile(resolve(distRoot, "./index.html"));
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8"
    });
    response.end(indexFile);
  }
}

export function startStudioServer(options: StartServerOptions = {}) {
  const port = options.port ?? 4173;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${port}`}`);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/examples") {
        sendJson(response, 200, { examples: exampleCatalog });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/run/example") {
        const body = await readJsonBody<ExampleRunBody>(request);
        sendJson(response, 200, await runExample(body));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/run/local") {
        const body = await readJsonBody<LocalRunBody>(request);
        const runtimeRequest = {
          modulePath: body.modulePath,
          propertiesPath: body.propertyPath,
          ...(body.exportName !== undefined ? { exportName: body.exportName } : {}),
          ...(body.seed !== undefined ? { seed: body.seed } : {}),
          ...(body.runs !== undefined ? { numRuns: body.runs } : {})
        };
        const report = await runRuntimeWorker(runtimeRequest);
        sendJson(response, 200, { report });
        return;
      }

      await serveStatic(response, url.pathname);
    } catch (error) {
      sendError(response, 500, error instanceof Error ? error.message : String(error));
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`Counterexample Studio UI: ${url}`);
    if (options.openBrowser && process.platform === "darwin") {
      spawn("open", [url], {
        detached: true,
        stdio: "ignore"
      }).unref();
    }
  });

  return server;
}
