/**
 * Captures RÉELLES de l'application Encadré, en mode démo (données simulées « Dar Hmeti »).
 *
 * 1. Lance le serveur de dev du dossier web/ avec les mocks forcés (aucune clé, aucun appel réseau),
 *    ou réutilise celui qui tourne déjà sur le port 5199.
 * 2. Ouvre Chrome (installé sur la machine) avec playwright-core, se connecte via « Continuer en démo ».
 * 3. Enregistre chaque écran dans public/captures/<nom>.png (1440 × 900, densité 1,5)
 *    et une version pleine page (hauteur limitée) dans public/captures/<nom>-long.png.
 *
 * Usage : node scripts/capture-app.mjs            (tout)
 *         node scripts/capture-app.mjs --parcours (seulement le parcours interactif)
 * Sous Windows, lancer depuis un chemin en C:\ majuscule.
 */
/* global document, window -- utilisés dans page.evaluate (exécutés dans le navigateur) */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const web = path.resolve(root, '..', 'web');
const out = path.join(root, 'public', 'captures');
fs.mkdirSync(out, { recursive: true });
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const onlyParcours = process.argv.includes('--parcours');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms) => Promise.race([p, pause(ms)]);

async function up() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

let server = null;
if (!(await up())) {
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: web,
    shell: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      VITE_USE_MOCKS: 'true',
      VITE_REAL_PARSE: 'false',
      VITE_REAL_ENDPOINTS: '',
      VITE_REAL_COACH: 'false',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
      VITE_MOCK_LATENCY_MS: '40',
      VITE_MOCK_FAIL_RATE: '0',
    },
  });
  for (let i = 0; i < 120 && !(await up()); i++) await pause(1000);
}

const SCRIPT = `INT. CAFÉ DE LA MÉDINA - JOUR

Amira lève le rideau de fer. Le café est vide.

MOUNIR
Sbe7 el khir ya khali.

EXT. RUELLES DE LA MÉDINA - JOUR

Amira court entre les étals. Elle serre un colis contre elle.

INT. APPARTEMENT D'AMIRA - NUIT

Amira et Slim se disputent à voix basse.

EXT. PLAGE DE LA GOULETTE - AUBE

Amira regarde la mer. Elle ouvre enfin le colis.`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();

  async function shot(name, url, { long = false } = {}) {
    if (url) await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await pause(900);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    if (long) {
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({
        path: path.join(out, `${name}-long.png`),
        fullPage: true,
        clip: { x: 0, y: 0, width: 1440, height: Math.min(h, 2700) },
      });
    }
    console.log(`✓ ${name}`);
  }
  /** Capture de la zone visible après avoir amené `locator` en haut de l'écran */
  async function shotAt(name, locator, offset = 140) {
    await locator.first().scrollIntoViewIfNeeded();
    const box = await locator.first().boundingBox();
    if (box) await page.evaluate((y) => window.scrollBy(0, y), box.y - offset);
    await pause(600);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(`✓ ${name}`);
  }

  await page.goto(BASE + '/connexion', { waitUntil: 'networkidle' });
  if (!onlyParcours) await shot('connexion');
  await page.getByRole('button', { name: /démo/i }).first().click();
  await page.waitForURL(/\/projet|\/planner/, { timeout: 15000 }).catch(() => {});
  await pause(800);

  if (!onlyParcours) {
    await shot('accueil', '/', { long: true });
    await shot('projet', '/projet', { long: true });
    await shot('planner', '/planner');
    await shot('planner-rapide', '/planner/rapide', { long: true });
    for (let e = 1; e <= 5; e++) await shot(`assistant-etape-${e}`, `/planner/projet?etape=${e}`, { long: true });
    await shot('equipe', '/equipe', { long: true });
    await shot('convocations', '/planner/convocations', { long: true });
    await shot('coach', '/coach', { long: true });
    await shot('passeport', '/passeport', { long: true });
    await page.goto(BASE + '/passeport', { waitUntil: 'networkidle' });
    const verify = await page.locator('a[href*="/verifier/"]').first().getAttribute('href').catch(() => null);
    if (verify) await shot('verification', verify, { long: true });
    for (const tab of ['trouver', 'selection', 'sous-titres', 'synopsis', 'page-film'])
      await shot(`festival-${tab}`, `/festival?onglet=${tab}`, { long: true });
    await shot('festival-dossiers', '/festival/dossiers', { long: true });
    await shot('sous-titres-relecture', '/festival/sous-titres', { long: true });
    await shot('mes-donnees', '/mes-donnees');
  }

  // ——— Parcours de démonstration : scénario → découpage → suggestions → lieux → planning ———
  await page.goto(BASE + '/planner/projet?etape=2', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: /Importer mon scénario/i }).click();
  await page.locator('summary', { hasText: 'Ou colle ton texte' }).click();
  await page.getByLabel('Texte du scénario').fill(SCRIPT);
  await shotAt('parcours-1-import', page.getByRole('tab', { name: /Importer mon scénario/i }), 120);

  await page.getByRole('button', { name: /Découper en scènes/i }).click();
  await pause(1500);
  const replace = page.getByRole('button', { name: /Remplacer mes scènes/i });
  if (await replace.isVisible().catch(() => false)) {
    await shotAt('parcours-2-choix', page.getByRole('dialog'), 140).catch(() => {});
    await replace.click();
    await pause(1200);
  }
  await shotAt('parcours-3-decoupage', page.getByRole('heading', { name: /Tes scènes/i }), 120);

  const relire = page.getByRole('button', { name: /Relire mes scènes/i });
  if (await relire.isVisible().catch(() => false)) {
    await relire.click();
    await pause(2000);
    await shotAt('parcours-4-suggestions', page.getByRole('button', { name: /Relire à nouveau/i }), 220);
    const accept = page.getByRole('button', { name: /^Accepter/ }).first();
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
      await pause(800);
      await shotAt('parcours-5-suggestion-acceptee', page.getByRole('button', { name: /Relire à nouveau/i }), 220);
    }
  }

  await page.goto(BASE + '/planner/projet?etape=3', { waitUntil: 'networkidle' });
  await pause(1200);
  await shot('parcours-6-lieux', null, { long: true });
  const propose = page.getByRole('button', { name: /Proposer des lieux pour ce décor/i }).first();
  if (await propose.isVisible().catch(() => false)) {
    await propose.click();
    await pause(2200);
    await shotAt('parcours-7-lieux-proposes', page.getByText('Ce que tes scènes demandent'), 200);
  }

  await page.goto(BASE + '/planner/calendrier', { waitUntil: 'networkidle' });
  const gen = page.getByRole('button', { name: /Générer le planning/i }).first();
  if (await gen.isVisible().catch(() => false)) {
    await gen.click();
    await pause(1200);
    // Garde-fou : des scènes proposées par l'IA ne sont pas encore validées
    const anyway = page.getByRole('button', { name: /Générer quand même/i });
    if (await anyway.isVisible().catch(() => false)) {
      await page.screenshot({ path: path.join(out, 'parcours-8-garde-fou.png') });
      console.log('✓ parcours-8-garde-fou');
      await anyway.click();
    }
    await pause(2500);
  }
  await shot('calendrier', null, { long: true });
  const day = await page.locator('a[href*="/planner/jour/"]').first().getAttribute('href').catch(() => null);
  if (day) await shot('feuille-de-service', day, { long: true });

  // ——— Maquettes de conception (canevas de design, avant le code) ———
  if (!onlyParcours) {
    const maq = path.join(web, 'docs', 'maquettes-kit-festival');
    for (const f of ['Main', 'SousTitres', 'DeclarationIA', 'Synopsis']) {
      const file = path.join(maq, `${f}.dc.html`);
      if (!fs.existsSync(file)) continue;
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' }).catch(() => {});
      await pause(1500);
      await page.screenshot({ path: path.join(out, `maquette-${f}.png`) });
      console.log(`✓ maquette-${f}`);
    }

    // Mobile (responsive)
    const m = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: 'fr-FR',
      reducedMotion: 'reduce',
      storageState: await ctx.storageState(),
    });
    const mp = await m.newPage();
    for (const [name, url] of [
      ['mobile-accueil', '/'],
      ['mobile-calendrier', '/planner/calendrier'],
      ['mobile-passeport', '/passeport'],
      ['mobile-coach', '/coach'],
    ]) {
      await mp.goto(BASE + url, { waitUntil: 'networkidle' });
      await pause(900);
      await mp.screenshot({ path: path.join(out, `${name}.png`) });
      console.log(`✓ ${name}`);
    }
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await withTimeout(browser.close(), 5000);
  if (server) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/f', '/t'], { shell: true });
    else server.kill();
  }
  setTimeout(() => process.exit(), 1500);
}
