/**
 * Export vidéo (facultatif) : enregistre la présentation qui se déroule seule, transitions comprises,
 * avec les durées « beatSeconds » de src/data/deck.ts. Dans la séquence démo, le parcours en
 * captures (C) défile automatiquement. Ne remplace pas la présentation interactive.
 *
 * Prérequis : npm run build. Usage : node scripts/export-video.mjs [--fast]
 *   --fast : 2 s par étape (aperçu rapide)
 * Sortie : export/video/*.webm (WebM VP8, 1920 × 1080). Conversion MP4 possible avec ffmpeg :
 *   ffmpeg -i export/video/xxx.webm -c:v libx264 -crf 18 -pix_fmt yuv420p encadre-prise-02.mp4
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'export', 'video');
fs.mkdirSync(out, { recursive: true });
const PORT = 4177;
const BASE = `http://localhost:${PORT}/`;
const fast = process.argv.includes('--fast');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const src = fs.readFileSync(path.join(root, 'src', 'data', 'deck.ts'), 'utf8');
const ids = [...src.matchAll(/^\s{4}id: '([^']+)',/gm)].map((m) => m[1]);
const secs = [...src.matchAll(/^\s{4}beatSeconds: \[([^\]]+)\],/gm)].map((m) => m[1].split(',').map(Number));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
for (let k = 0; k < 60; k++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* pas prêt */
  }
  await pause(500);
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: out, size: { width: 1920, height: 1080 } } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.mouse.move(1919, 0); // la barre de contrôle se cache
  for (let s = 0; s < ids.length; s++) {
    for (let b = 0; b < secs[s].length; b++) {
      if (ids[s] === 'demo') {
        await pause(3000);
        await page.click('text=Parcours en captures');
        for (let k = 0; k < 9; k++) {
          await pause(fast ? 1200 : 3500);
          await page.keyboard.press('ArrowRight');
        }
        await pause(3000);
        await page.keyboard.press('Escape');
        await page.mouse.move(1919, 0);
      } else {
        await pause((fast ? 2 : secs[s][b]) * 1000);
      }
      if (!(s === ids.length - 1 && b === secs[s].length - 1)) await page.keyboard.press('ArrowRight');
    }
  }
  await pause(3000);
  await ctx.close();
  console.log(`Vidéo enregistrée dans ${out}`);
} finally {
  await Promise.race([browser.close(), pause(4000)]);
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { shell: true });
  else server.kill();
  setTimeout(() => process.exit(), 1500);
}
