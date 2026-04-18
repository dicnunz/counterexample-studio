import type { JsonValue, LocalPathDraft } from "./model";

const localStudioRunCommand = "npm run studio -- run";

export function formatJson(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}

export function formatInputTuple(value: readonly JsonValue[]): string {
  return JSON.stringify(value, null, 2);
}

export function formatDuration(elapsedMs: number): string {
  if (elapsedMs < 1000) {
    return `${elapsedMs} ms`;
  }

  return `${(elapsedMs / 1000).toFixed(2)} s`;
}

export function formatSeed(seed: number): string {
  return seed.toLocaleString("en-US");
}

export function buildBundledRerunCommand(exampleId: string, seed: number, runs: number): string {
  return `${localStudioRunCommand} --example ${quoteShell(exampleId)} --seed ${seed} --runs ${runs}`;
}

export function buildLocalPreviewCommand(draft: LocalPathDraft): string {
  return [
    localStudioRunCommand,
    `--module ${quoteShell(draft.modulePath)}`,
    `--export ${quoteShell(draft.exportName)}`,
    `--property ${quoteShell(draft.propertyPath)}`,
    `--seed ${draft.seed}`,
    `--runs ${draft.runs}`
  ].join(" ");
}

export function quoteShell(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  return `'${value.replaceAll("'", `'\\''`)}'`;
}
