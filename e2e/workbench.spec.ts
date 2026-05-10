import { expect, type Locator, type Page, test } from "@playwright/test";

const BUGGY_EXAMPLE = /buggy|broken|failing|fails/i;
const FIXED_EXAMPLE = /fixed|correct|passing|passes/i;

test.describe("Counterexample Studio workbench", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Counterexample Studio/i);
    await requireVisible("workbench heading", [
      page.getByRole("heading", {
        name: /counterexample studio|property-based testing workbench|property-based testing/i
      }),
      page.locator("main h1")
    ]);
  });

  test("shows the core workbench controls", async ({ page }) => {
    await requireVisible("example picker", [
      page.getByTestId("example-picker"),
      page.getByRole("combobox", { name: /example|bundled example/i }),
      page.getByLabel(/example|bundled example/i)
    ]);

    await requireVisible("run control", [
      page.getByTestId("run-button"),
      page.getByRole("button", { name: /run example|run property|run/i })
    ]);
  });

  test("shows the paid operator kit route without hiding approval boundaries", async ({ page }) => {
    const route = page.getByRole("link", { name: /agent browser operator os/i });

    await expect(route).toBeVisible();
    await expect(route).toHaveAttribute(
      "href",
      "https://nicdunz.gumroad.com/l/agent-browser-operator-os"
    );

    const body = page.locator("body");
    await expect(body).toContainText(/self-serve browser\/account\/public-action control templates/i);
    await expect(body).toContainText(/approval lanes/i);
    await expect(body).toContainText(/proof capture/i);
    await expect(body).toContainText(/handoffs/i);
    await expect(body).toContainText(/go\/no-go checks/i);
    await expect(body).toContainText(/No Chrome plugin repair/i);
    await expect(body).toContainText(/posting without human approval/i);
  });

  test("reports a reproducible failure for a bundled buggy example", async ({ page }) => {
    await selectExample(page, BUGGY_EXAMPLE);
    await runSelectedExample(page);

    const body = page.locator("body");
    await expect(body).toContainText(/property failed|counterexample found|falsified|minimal counterexample/i);
    await expect(body).toContainText(/seed/i);
    await expect(body).toContainText(/rerun command|rerun same seed|reproduction snippet|reproduction/i);
    await expect(body).toContainText(/failing input|minimal counterexample|counterexample input/i);
    await expect(body).toContainText(/shrink path/i);
    await expect(body).toContainText(/search trace/i);
    await expect(body).toContainText(/invariant/i);
    await expect(body).toContainText(/actual/i);

    const firstSeed = await extractSeed(page);
    const rerunControl = await requireVisible("rerun control", [
      page.getByTestId("rerun-button"),
      page.getByRole("button", { name: /rerun same seed|rerun|run again/i })
    ]);

    await rerunControl.click();
    await expect.poll(async () => readSeed(page)).toBe(firstSeed);
    await expect(body).toContainText(/property failed|counterexample found|falsified|minimal counterexample/i);
  });

  test("shows a clear passing state for a bundled fixed example", async ({ page }) => {
    await selectExample(page, FIXED_EXAMPLE);
    await runSelectedExample(page);

    const body = page.locator("body");
    await expect(body).toContainText(/passed|no counterexample|property holds/i);
    await expect(body).not.toContainText(/property failed|counterexample found|falsified|minimal counterexample/i);
  });
});

async function selectExample(page: Page, pattern: RegExp): Promise<void> {
  const nativePickerCandidates = [
    page.getByTestId("example-picker"),
    page.getByRole("combobox", { name: /example|bundled example/i }),
    page.getByLabel(/example|bundled example/i)
  ];

  for (const candidate of nativePickerCandidates) {
    if (await trySelectFromNativeControl(candidate, pattern)) {
      return;
    }
  }

  const combobox = page.getByRole("combobox", { name: /example|bundled example/i }).first();
  const visibleCombobox = await firstVisibleMatch(combobox);
  if (visibleCombobox) {
    await visibleCombobox.click();
    const option = await findVisible(page, [
      page.getByRole("option", { name: pattern }),
      page.getByRole("button", { name: pattern }),
      page.getByText(pattern)
    ]);

    if (option) {
      await option.click();
      return;
    }
  }

  const directChoice = await findVisible(page, [
    page.getByRole("button", { name: pattern }),
    page.getByRole("radio", { name: pattern }),
    page.getByRole("option", { name: pattern }),
    page.getByRole("link", { name: pattern }),
    page.getByText(pattern)
  ]);

  if (directChoice) {
    await directChoice.click();
    return;
  }

  throw new Error(`Could not select a bundled example matching ${pattern}`);
}

async function runSelectedExample(page: Page): Promise<void> {
  const runControl = await requireVisible("run control", [
    page.getByTestId("run-button"),
    page.getByRole("button", { name: /run example|run property|run/i })
  ]);

  await runControl.click();
}

async function extractSeed(page: Page): Promise<string> {
  const seed = await readSeed(page);
  expect(seed, "Expected a numeric deterministic seed in the report").not.toBeNull();
  return seed!;
}

async function readSeed(page: Page): Promise<string | null> {
  const text = await page.locator("body").innerText();
  return text.match(/\bseed\b[^\n\r\d-]*(-?\d+)/i)?.[1] ?? null;
}

async function trySelectFromNativeControl(locator: Locator, pattern: RegExp): Promise<boolean> {
  const visibleControl = await firstVisibleMatch(locator);
  if (!visibleControl) {
    return false;
  }

  const tagName = await visibleControl.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
  if (tagName !== "select") {
    return false;
  }

  const value = await visibleControl.evaluate(
    (element, serializedPattern) => {
      const select = element as HTMLSelectElement;
      const matcher = new RegExp(serializedPattern.source, serializedPattern.flags);
      const option = Array.from(select.options).find((entry) => {
        return matcher.test(entry.label) || matcher.test(entry.text) || matcher.test(entry.value);
      });
      return option?.value ?? null;
    },
    { source: pattern.source, flags: pattern.flags }
  );

  if (!value) {
    throw new Error(`Native example picker does not include an option matching ${pattern}`);
  }

  await visibleControl.selectOption(value);
  return true;
}

async function requireVisible(description: string, candidates: Locator[]): Promise<Locator> {
  const locator = await findVisible(undefined, candidates);
  if (locator) {
    return locator;
  }

  throw new Error(`Could not find a visible ${description}`);
}

async function findVisible(page: Page | undefined, candidates: Locator[]): Promise<Locator | null> {
  for (const candidate of candidates) {
    const visibleMatch = await firstVisibleMatch(candidate);
    if (visibleMatch) {
      return visibleMatch;
    }
  }

  if (page) {
    const textMatches = await page.locator("body").innerText();
    throw new Error(`No visible candidate matched. Current body text:\n${textMatches}`);
  }

  return null;
}

async function firstVisibleMatch(locator: Locator): Promise<Locator | null> {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const match = locator.nth(index);
    if (await match.isVisible()) {
      return match;
    }
  }

  return null;
}
