// Render the app icons (PNG) from static/icons/icon.svg in headless Chrome/Edge.
// Run after changing the logo: node scripts/icons.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "static", "icons");
const svg = fs.readFileSync(path.join(dir, "icon.svg"), "utf8");
let browser;
for (const channel of ["chrome", "msedge"]) {
  try { browser = await chromium.launch({ channel, headless: true }); break; } catch { /* try next */ }
}
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await page.locator("svg").screenshot({ path: path.join(dir, `icon-${size}.png`), omitBackground: true });
  console.log(`icon-${size}.png`);
}
await browser.close();
