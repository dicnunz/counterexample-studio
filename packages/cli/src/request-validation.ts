import type { RuntimeWorkerRequest } from "./runtime-client.js";

export class RequestError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError("Expected a JSON request object.");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 4096) throw new RequestError(`${label} must be a nonempty string of at most 4096 characters.`);
  return value;
}

function integer(value: unknown, label: string, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new RequestError(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}

export function parseLocalRunRequest(value: unknown): RuntimeWorkerRequest {
  const body = object(value);
  const seed = integer(body.seed, "Seed", -2147483648, 2147483647);
  const numRuns = integer(body.runs, "Runs", 1, 10000);
  const request: RuntimeWorkerRequest = {
    modulePath: requiredString(body.modulePath, "Target module"),
    propertiesPath: requiredString(body.propertyPath, "Property definition"),
    ...(body.exportName !== undefined ? { exportName: requiredString(body.exportName, "Export override") } : {}),
    ...(body.caseId !== undefined ? { caseId: requiredString(body.caseId, "Property ID") } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(numRuns !== undefined ? { numRuns } : {})
  };
  if (body.path !== undefined) {
    if (typeof body.path !== "string" || body.path.length > 4096 || !/^\d+(?::\d+)*$/.test(body.path)) throw new RequestError("Shrink path must contain colon-separated nonnegative integers.");
    if (!request.caseId || request.seed === undefined) throw new RequestError("Replaying a shrink path requires the saved property ID and seed.");
    return { ...request, path: body.path };
  }
  return request;
}

export function parseExampleRunRequest(value: unknown) {
  const body = object(value);
  return {
    exampleId: requiredString(body.exampleId, "Example ID"),
    seed: integer(body.seed, "Seed", -2147483648, 2147483647),
    runs: integer(body.runs, "Runs", 1, 10000)
  };
}
