/* global document -- utilisé dans page.evaluate (exécuté dans le navigateur) */
/**
 * Export statique de secours : chaque étape de chaque séquence en image 1920 × 1080,
 * puis un PDF (une page par étape). Sert aussi de contrôle visuel.
 *
 * Prérequis : npm run build (le script sert dist/ avec « vite preview »).
 * Usage : node scripts/export-pdf.mjs [--size 1366x768] [--only 3]
 * Sortie : export/frames/*.png et export/encadre-prise-02.pdf
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'export');
const frames = path.join(outDir, 'frames');
fs.mkdirSync(frames, { recursive: true });
const PORT = 4175;
const BASE = `http://localhost:${PORT}/`;
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const [W, H] = (arg('--size') ?? '1920x1080').split('x').map(Number);
const only = arg('--only');

// Structure du deck : nombre d'étapes par séquence, lu dans le code source
const deckSrc = fs.readFileSync(path.join(root, 'src', 'data', 'deck.ts'), 'utf8');
const beats = [...deckSrc.matchAll(/^\s{4}beats: (\d+),/gm)].map((m) => Number(m[1]));
const ids = [...deckSrc.matchAll(/^\s{4}id: '([^']+)',/gm)].map((m) => m[1]);

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('dist/ introuvable : lancer « npm run build » d’abord.');
  process.exit(1);
}
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* pas prêt */
  }
  await pause(500);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const files = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: W < 1920 ? 1 : 1 });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (let s = 0; s < beats.length; s++) {
    if (only !== undefined && String(s) !== only) continue;
    for (let b = 0; b < beats[s]; b++) {
      await page.goto(`${BASE}?print=1&s=${s}&b=${b}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await pause(500);
      const file = path.join(frames, `${String(s).padStart(2, '0')}-${ids[s]}-${b + 1}${W !== 1920 ? `-${W}` : ''}.png`);
      await page.screenshot({ path: file });
      files.push(file);
      console.log(`✓ ${path.basename(file)}`);
    }
  }
  if (only === undefined && W === 1920) {
    const html = `<!doctype html><html><head><style>@page{size:1920px 1080px;margin:0}body{margin:0}img{display:block;width:1920px;height:1080px;page-break-after:always}</style></head><body>${files
      .map((f) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`)
      .join('')}</body></html>`;
    const pdfPage = await browser.newPage();
    await pdfPage.setContent(html, { waitUntil: 'load' });
    await pdfPage.pdf({ path: path.join(outDir, 'encadre-prise-02.pdf'), width: '1920px', height: '1080px', printBackground: true });
    console.log(`PDF : ${path.join(outDir, 'encadre-prise-02.pdf')}`);
  }
} finally {
  await Promise.race([browser.close(), pause(4000)]);
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { shell: true });
  else server.kill();
  if (errors.length) {
    console.log(`\n${errors.length} erreur(s) dans la page :`);
    [...new Set(errors)].forEach((e) => console.log(' - ' + e));
  }
  setTimeout(() => process.exit(), 1500);
}
