import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const savedFailure = JSON.parse(await readFile(new URL("../reports/chunk-buggy-chunk-preserves-values.json", import.meta.url), "utf8"));
const savedPass = JSON.parse(await readFile(new URL("../reports/chunk-fixed-chunk-preserves-values.json", import.meta.url), "utf8"));

test.describe("Counterexample Studio workbench", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Chunk preserves all values" })).toBeVisible();
    await expect(page.getByTestId("run-button")).toBeEnabled();
  });

  test("replays an actual failure with saved metadata and preserves the witness", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: testInfo.outputPath("workbench.png"), fullPage: true });
    await page.getByLabel("Runs", { exact: true }).fill("350");
    await page.getByTestId("run-button").click();
    await expect(page.getByTestId("rerun-button")).toBeEnabled();
    const input = await page.locator(".code-frame").first().innerText();
    const request = page.waitForRequest((entry) => entry.url().endsWith("/api/run/local"));
    await page.getByRole("button", { name: "Replay exact failure" }).click();
    expect((await request).postDataJSON()).toMatchObject({ caseId: "chunk-preserves-values", seed: 87492311, runs: 350, path: "0:0:0", exportName: "chunk" });
    await expect(page.getByRole("status")).toContainText("minimal witness matches");
    await expect(page.locator(".code-frame").first()).toHaveText(input);
  });

  test("shows a passing state for the paired fixed implementation with the same seed", async ({ page }) => {
    await page.getByRole("button", { name: "Try fixed version" }).click();
    await expect(page.getByText("Passed all 100 sampled runs. No counterexample found.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invariant satisfied" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Counterexample", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Seed", { exact: true })).toHaveValue("87492311");
    await page.getByTestId("rerun-button").click();
    await expect(page.getByRole("status")).toContainText("same seed and sampling budget");
  });

  test("imports every suite case without executing code and exports the original data", async ({ page }) => {
    const suite = { ...savedFailure, title: "Saved multi-property report", cases: [{ ...savedPass.cases[0], id: "first-pass" }, savedFailure.cases[0]] };
    const requests: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/api/run/")) requests.push(request.url()); });
    await page.getByRole("button", { name: "Import JSON", exact: true }).click();
    await page.getByLabel("Or paste report JSON").fill(JSON.stringify(suite));
    await page.getByRole("button", { name: "Open report", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Report imported. No code was executed.");
    await expect(page.getByLabel("Inspect property")).toHaveValue("chunk-preserves-values");
    await page.getByLabel("Inspect property").selectOption("first-pass");
    await expect(page.getByRole("heading", { name: "Invariant satisfied" })).toBeVisible();
    expect(requests).toEqual([]);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(JSON.parse(await readFile(path!, "utf8"))).toEqual(suite);
  });

  test("rejects malformed imports and keeps the existing report", async ({ page }) => {
    await page.getByRole("button", { name: "Import JSON", exact: true }).click();
    await page.getByLabel("Or paste report JSON").fill('{"cases":[]}');
    await page.getByRole("button", { name: "Open report", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Invalid report");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Counterexample", exact: true })).toBeVisible();
  });

  test("keeps failure evidence when the replay server errors and allows a retry", async ({ page }) => {
    await page.route("**/api/run/local", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Target module could not be loaded" }) }));
    await page.getByRole("button", { name: "Replay exact failure" }).click();
    await expect(page.getByRole("alert")).toContainText("Target module could not be loaded");
    await expect(page.getByRole("heading", { name: "Counterexample", exact: true })).toBeVisible();
    await expect(page.getByTestId("rerun-button")).toBeEnabled();
    await page.unroute("**/api/run/local");
    await page.getByTestId("rerun-button").click();
    await expect(page.getByRole("status")).toContainText("Failure reproduced");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("can import reports while the local engine is disconnected", async ({ page }) => {
    await page.route("**/api/examples", (route) => route.abort());
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("Cannot reach the local engine");
    await page.getByRole("button", { name: "Import JSON", exact: true }).click();
    await page.getByLabel("Choose JSON file").setInputFiles({ name: "saved.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(savedFailure)) });
    await expect(page.getByRole("heading", { name: "Chunk preserves all values" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("No code was executed");
  });

  test("works at mobile width without document overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Import JSON", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Search trace", exact: true }).click();
    await expect(page.getByText(/recorded attempts/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Import JSON", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
