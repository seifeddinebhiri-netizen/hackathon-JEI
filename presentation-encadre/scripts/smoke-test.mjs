/* global document, window, getComputedStyle -- utilisés dans page.evaluate */
/**
 * Test de bout en bout de la présentation EN DIRECT (transitions réelles) :
 * parcourt tout le deck au clavier, capture le milieu de chaque transition entre séquences,
 * vérifie la navigation (← retour, chiffres, plan, Échap) et l'absence d'erreur JavaScript.
 * Prérequis : npm run build. Usage : node scripts/smoke-test.mjs [--size 1366x768]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'export', 'smoke');
fs.mkdirSync(out, { recursive: true });
const PORT = 4176;
const BASE = `http://localhost:${PORT}/`;
const i = process.argv.indexOf('--size');
const [W, H] = (i > 0 ? process.argv[i + 1] : '1920x1080').split('x').map(Number);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const deckSrc = fs.readFileSync(path.join(root, 'src', 'data', 'deck.ts'), 'utf8');
const beats = [...deckSrc.matchAll(/^\s{4}beats: (\d+),/gm)].map((m) => Number(m[1]));
const total = beats.reduce((a, b) => a + b, 0);

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
const errors = [];
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('ERR_CONNECTION_REFUSED') && errors.push(m.text()));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const hash = () => page.evaluate(() => window.location.hash);
  await pause(2500);

  // Parcours complet : → à chaque étape ; capture au milieu de chaque transition
  let shots = 0;
  const removed = [];
  for (let step = 1; step < total; step++) {
    const before = await hash();
    await page.keyboard.press('ArrowRight');
    const [s0] = before.slice(1).split('.').map(Number);
    await pause(380);
    const [s1] = (await hash()).slice(1).split('.').map(Number);
    if (s1 === s0 && (await page.evaluate(() => getComputedStyle(document.querySelector('.z-40[aria-hidden]')).display !== 'none'))) {
      await page.screenshot({ path: path.join(out, `transition-${String(++shots).padStart(2, '0')}.png`) });
    }
    await pause(1900);
    if (/r[ée]gie/i.test(await page.evaluate(() => document.body.innerText))) removed.push(await hash());
  }
  check(removed.length === 0, `aucune trace des séquences supprimées${removed.length ? " : " + removed.join(", ") : ""}`);
  const end = await hash();
  check(end === `#${beats.length - 1}.${beats[beats.length - 1] - 1}`, `fin du deck atteinte au clavier (${end})`);
  await page.screenshot({ path: path.join(out, 'fin.png') });

  // Retour arrière : ← jusqu'à la séquence précédente
  for (let k = 0; k < beats[beats.length - 1]; k++) {
    await page.keyboard.press('ArrowLeft');
    await pause(900);
  }
  check((await hash()).startsWith(`#${beats.length - 2}.`), `← revient à la séquence précédente (${await hash()})`);

  // Chiffre : 3 → les quatre modules ; façade puis envers du décor, pour chacun des 4 modules
  await page.keyboard.press('3');
  await pause(1500);
  check((await hash()) === '#6.0', `touche 3 → quatre modules (${await hash()})`);
  for (let m = 1; m <= 4; m++) {
    await page.keyboard.press('ArrowRight');
    await pause(1700);
    const front = await page.evaluate((n) => getComputedStyle(document.querySelector(`.mod-${n}`)).opacity, m);
    await page.keyboard.press('ArrowRight');
    await pause(380);
    await page.screenshot({ path: path.join(out, `module-${m}-negatif.png`) });
    await pause(1600);
    const back = await page.evaluate((n) => getComputedStyle(document.querySelector(`.mod-${n} .back`)).visibility, m);
    check(front === '1' && back === 'visible', `module ${m} : façade puis envers du décor`);
    await page.screenshot({ path: path.join(out, `module-${m}-back.png`) });
  }

  // Démo : parcours en captures, flèches internes, Échap
  await page.keyboard.press('4');
  await pause(1500);
  await page.click('text=Parcours en captures');
  await pause(300);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await pause(500);
  check(await page.isVisible('text=Étape 3 / 10'), 'démo C : → avance dans les captures, pas dans le deck');
  check((await hash()) === '#7.0', 'démo : le deck ne bouge pas');
  await page.screenshot({ path: path.join(out, 'demo-captures.png') });
  await page.keyboard.press('Escape');
  await pause(300);
  check(await page.isVisible('text=Place à la démonstration'), 'Échap revient au choix des modes');

  // Plan (P) puis saut
  await page.keyboard.press('p');
  await pause(300);
  check(await page.isVisible('[role="dialog"][aria-label="Plan de la présentation"]'), 'P ouvre le plan');
  await page.screenshot({ path: path.join(out, 'plan.png') });
  await page.keyboard.press('Escape');

  // Animations réduites : la navigation fonctionne toujours
  await page.keyboard.press('m');
  await page.keyboard.press('Home');
  await pause(700);
  await page.keyboard.press('ArrowRight');
  await pause(300);
  check((await hash()) === '#0.1', `mode réduit : → fonctionne (${await hash()})`);
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await Promise.race([browser.close(), pause(4000)]);
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { shell: true });
  else server.kill();
  const uniq = [...new Set(errors)];
  console.log(uniq.length ? `\n${uniq.length} erreur(s) JavaScript :\n - ${uniq.join('\n - ')}` : '\nAucune erreur JavaScript.');
  console.log(failures ? `${failures} vérification(s) en échec` : 'Toutes les vérifications passent.');
  setTimeout(() => process.exit(failures || uniq.length ? 1 : 0), 1500);
}
