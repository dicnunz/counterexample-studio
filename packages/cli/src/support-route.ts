export const AGENT_BROWSER_OPERATOR_OS_URL =
  "https://nicdunz.gumroad.com/l/agent-browser-operator-os";

export const SUPPORT_ROUTE_TITLE = "Agent Browser Operator OS";

export const SUPPORT_ROUTE_SUMMARY =
  "Self-serve browser/account/public-action control templates: approval lanes, proof capture, handoffs, and go/no-go checks.";

export const SUPPORT_ROUTE_BOUNDARY =
  "Not Chrome plugin repair, guaranteed automation, account access, custom setup, calls, legal/financial/security advice, or posting without human approval.";

export function formatSupportRoute(): string {
  return [
    "Support Counterexample Studio:",
    `- ${SUPPORT_ROUTE_TITLE}: ${AGENT_BROWSER_OPERATOR_OS_URL}`,
    `- ${SUPPORT_ROUTE_SUMMARY}`,
    `- ${SUPPORT_ROUTE_BOUNDARY}`
  ].join("\n");
}
