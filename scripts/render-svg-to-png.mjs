import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const [inputArg, outputArg, widthArg, heightArg] = process.argv.slice(2);

  if (!inputArg || !outputArg) {
    throw new Error("Usage: node scripts/render-svg-to-png.mjs <input.svg> <output.png> [width] [height]");
  }

  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  const width = Number(widthArg ?? 1200);
  const height = Number(heightArg ?? 630);

  await mkdir(dirname(outputPath), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {
      width,
      height
    },
    deviceScaleFactor: 2
  });

  await page.goto(pathToFileURL(inputPath).href);
  await page.screenshot({
    path: outputPath,
    omitBackground: false
  });
  await browser.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
