import { findExample, exampleCatalog, loadExample } from "./catalog.js";

async function main() {
  const summaries = [];

  for (const example of exampleCatalog) {
    const report = await loadExample(findExample(example.id));
    const firstCase = report.cases[0];
    const actualOutcome = firstCase?.status === "fail" ? "fail" : "pass";
    const matchesExpectation = actualOutcome === example.expectedOutcome;

    summaries.push({
      id: example.id,
      title: example.title,
      expected: example.expectedOutcome,
      actual: actualOutcome,
      counterexamplePath: firstCase?.counterexamplePath ?? "n/a",
      seed: firstCase?.seed ?? example.defaultSeed,
      ok: matchesExpectation
    });
  }

  for (const summary of summaries) {
    const marker = summary.ok ? "PASS" : "FAIL";
    console.log(
      `${marker}  ${summary.id.padEnd(20)} expected=${summary.expected.padEnd(4)} actual=${summary.actual.padEnd(4)} seed=${String(summary.seed).padEnd(10)} path=${summary.counterexamplePath}`
    );
  }

  if (summaries.some((summary) => !summary.ok)) {
    process.exitCode = 1;
  }
}

void main();
