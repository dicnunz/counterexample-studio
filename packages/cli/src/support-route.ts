export const AGENT_BROWSER_OPERATOR_OS_URL =
  "https://nicdunz.gumroad.com/l/agent-browser-operator-os";
export const SUPPORT_RECEIPT_URL = "https://nicdunz.gumroad.com/l/smrimu";
export const MINI_AUDIT_URL =
  "https://nicdunz.gumroad.com/l/agent-workflow-mini-audit";

export const SUPPORT_ROUTE_TITLE = "Agent Browser Operator OS";

export const SUPPORT_ROUTE_SUMMARY =
  "Self-serve browser/account/public-action control templates: approval lanes, proof capture, handoffs, and go/no-go checks.";

export const SUPPORT_ROUTE_BOUNDARY =
  "Redacted artifacts only. Not Chrome plugin repair, guaranteed automation, account access, custom setup, calls, legal/financial/security advice, or posting without human approval.";

export function formatSupportRoute(): string {
  return [
    "Support Counterexample Studio:",
    `- ${SUPPORT_ROUTE_TITLE}: ${AGENT_BROWSER_OPERATOR_OS_URL}`,
    `- Optional $5 receipt: ${SUPPORT_RECEIPT_URL}`,
    `- Written mini audit for a redacted property test, shrink trace, or repro bundle: ${MINI_AUDIT_URL}`,
    `- ${SUPPORT_ROUTE_SUMMARY}`,
    `- ${SUPPORT_ROUTE_BOUNDARY}`
  ].join("\n");
}
