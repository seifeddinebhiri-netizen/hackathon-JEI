/**
 * Captures des maquettes de conception du Kit Festival (web/docs/maquettes-kit-festival/*.dc.html),
 * réalisées AVANT le code : elles servent à montrer « maquette → interface réelle ».
 * Usage : node scripts/capture-maquettes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const maq = path.resolve(root, '..', 'web', 'docs', 'maquettes-kit-festival');
const out = path.join(root, 'public', 'captures');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  for (const f of ['Main', 'SousTitres', 'DeclarationIA', 'Synopsis']) {
    const file = path.join(maq, `${f}.dc.html`);
    if (!fs.existsSync(file)) continue;
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(out, `maquette-${f}.png`) });
    console.log(`✓ maquette-${f}`);
  }
} finally {
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 4000))]);
  process.exit();
}
