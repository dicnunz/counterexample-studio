import { describe, expect, it } from "vitest";
import {
  AGENT_BROWSER_OPERATOR_OS_URL,
  formatSupportRoute,
  SUPPORT_ROUTE_BOUNDARY,
  SUPPORT_ROUTE_SUMMARY,
  SUPPORT_ROUTE_TITLE
} from "./support-route.js";

describe("support route", () => {
  it("points to the Agent Browser Operator OS Gumroad product", () => {
    expect(formatSupportRoute()).toContain(SUPPORT_ROUTE_TITLE);
    expect(formatSupportRoute()).toContain(AGENT_BROWSER_OPERATOR_OS_URL);
  });

  it("keeps the buyer promise self-serve and approval-first", () => {
    expect(SUPPORT_ROUTE_SUMMARY).toMatch(/self-serve/i);
    expect(SUPPORT_ROUTE_SUMMARY).toMatch(/approval lanes/i);
    expect(SUPPORT_ROUTE_SUMMARY).toMatch(/proof capture/i);
    expect(SUPPORT_ROUTE_SUMMARY).toMatch(/handoffs/i);
    expect(SUPPORT_ROUTE_SUMMARY).toMatch(/go\/no-go checks/i);
  });

  it("keeps excluded services explicit", () => {
    expect(SUPPORT_ROUTE_BOUNDARY).toMatch(/not chrome plugin repair/i);
    expect(SUPPORT_ROUTE_BOUNDARY).toMatch(/guaranteed automation/i);
    expect(SUPPORT_ROUTE_BOUNDARY).toMatch(/account access/i);
    expect(SUPPORT_ROUTE_BOUNDARY).toMatch(/custom setup/i);
    expect(SUPPORT_ROUTE_BOUNDARY).toMatch(/calls/i);
    expect(SUPPORT_ROUTE_BOUNDARY).toMatch(/legal\/financial\/security advice/i);
    expect(SUPPORT_ROUTE_BOUNDARY).toMatch(/posting without human approval/i);
  });
});
