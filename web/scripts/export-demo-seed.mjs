/**
 * Exporte les données de démonstration du Kit Festival (projet « Dar Hmeti », dossiers, pièces,
 * Passeport IA, sous-titres) vers backend/data/demo_kit.json, lu par backend/scripts/seed_kit_demo.py.
 * Source unique : les mocks du front (src/api/mocks). Usage : node scripts/export-demo-seed.mjs
 * Aucun serveur n'est ouvert (vite en mode intergiciel, sans HMR).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../../backend/data/demo_kit.json', import.meta.url));

const vite = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { buildDemoProject, DEMO_PIECES } = await vite.ssrLoadModule('/src/api/mocks/data/project.ts');
  const { demoPassport } = await vite.ssrLoadModule('/src/api/mocks/db.ts');
  const subtitles = (await vite.ssrLoadModule('/src/api/mocks/data/subtitles.json')).default;

  const p = buildDemoProject();
  const pass = demoPassport(p.id);
  const day = 24 * 3600 * 1000;
  const offset = (iso) =>
    Math.round((Date.parse(iso) - Date.parse(new Date().toISOString().slice(0, 10))) / day);
  const data = {
    project: {
      title: p.title,
      format: p.format,
      city: p.city,
      // Dates relatives à aujourd'hui (recalculées par le seed)
      shooting_window_offsets: { from: offset(p.shooting_window.from), to: offset(p.shooting_window.to) },
      max_hours_per_day: p.max_hours_per_day,
      locations: p.locations,
      scenes: p.scenes,
      people: p.people,
    },
    film_kit: { ...p.film_profile, synopsis: p.synopsis, stills: p.film_page.stills },
    dossiers: p.festival_shortlist.map((s) => ({ festival_id: s.festival_id, status: s.status })),
    // Une ligne par clé de pièce (jamais une copie par dossier)
    pieces: Object.entries(DEMO_PIECES).map(([key, state]) => ({ key, state })),
    passport: {
      film_title: pass.film_title,
      director: pass.director,
      declarations: pass.declarations,
      c2pa_signed: pass.c2pa_signed,
      badge_code: pass.badge_code,
    },
    subtitles: {
      source_lang: subtitles.source_lang,
      lines: subtitles.lines,
      processing: subtitles.processing,
    },
  };
  writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Écrit : ${out}`);
} finally {
  await vite.close();
}
