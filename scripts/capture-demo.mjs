import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:4173";
const screenshotPath = resolve("assets/screenshots/workbench.png");
const gifPath = resolve("assets/demo.gif");
const videoDirectory = resolve("assets/.tmp-video");

async function main() {
  await mkdir(dirname(screenshotPath), { recursive: true });
  await mkdir(videoDirectory, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1080
    },
    recordVideo: {
      dir: videoDirectory,
      size: {
        width: 1440,
        height: 1080
      }
    }
  });

  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");

  await page.selectOption('[data-testid="example-picker"]', "binary-search-buggy");
  await page.getByTestId("run-button").click();
  await page.getByText(/counterexample found/i).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  await page.selectOption('[data-testid="example-picker"]', "chunk-fixed");
  await page.getByTestId("run-button").click();
  await page.getByRole("heading", { name: /passed all sampled runs/i }).waitFor();
  await page.waitForTimeout(1200);

  const video = page.video();
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error("Playwright did not produce a video");
  }

  const videoPath = await video.path();
  execFileSync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    "fps=10,scale=1200:-1:flags=lanczos",
    gifPath
  ], {
    stdio: "inherit"
  });

  console.log(`Screenshot: ${screenshotPath}`);
  console.log(`GIF: ${gifPath}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
