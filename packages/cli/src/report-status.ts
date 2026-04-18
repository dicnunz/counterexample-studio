import type { SuiteRunReport } from "@counterexample-studio/core";

export function reportHasFailures(report: Pick<SuiteRunReport, "cases">): boolean {
  return report.cases.some((caseReport) => caseReport.status === "fail");
}
