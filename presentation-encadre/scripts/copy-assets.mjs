/**
 * Copie les ressources ORIGINALES de l'application (jamais redessinées) :
 * mascotte Baba Jamil (7 poses SVG animées), logos encadré, quelques photos.
 * Usage : node scripts/copy-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const web = path.resolve(root, '..', 'web', 'public');
const pub = path.join(root, 'public');

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`✓ ${path.relative(root, to)}`);
};

for (const f of fs.readdirSync(path.join(web, 'mascotte'))) copy(path.join(web, 'mascotte', f), path.join(pub, 'mascotte', f));
for (const f of [
  'encadre-favicon.svg',
  'encadre-logo-transparent-pour-fond-sombre.svg',
  'encadre-logo-transparent-pour-fond-clair.svg',
  'encadre-logo-slogan-sombre.svg',
  'encadre-logo-slogan-clair.svg',
])
  copy(path.join(web, 'brand', 'svg', f), path.join(pub, 'brand', f));
