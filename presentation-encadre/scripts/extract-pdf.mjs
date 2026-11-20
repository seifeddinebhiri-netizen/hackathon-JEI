/**
 * Extrait du PDF de la première présentation :
 *  - un rendu PNG de chaque page (souvenirs de la séquence « Précédemment ») ;
 *  - les photos réelles intégrées (témoignages, El Teatro), en taille d'origine.
 *
 * Usage : node scripts/extract-pdf.mjs "C:/chemin/Dar_hmeti_Presentation.pdf"
 * Sortie : public/premier-pitch/page-XX.png et public/premier-pitch/img-pX-N.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { PNG } from 'pngjs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = process.argv[2] ?? path.join(process.env.USERPROFILE ?? '', 'Downloads', 'Dar_hmeti_Presentation.pdf');
const out = path.join(root, 'public', 'premier-pitch');
fs.mkdirSync(out, { recursive: true });

if (!fs.existsSync(src)) {
  console.error(`PDF introuvable : ${src}`);
  process.exit(1);
}

const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(src)), verbosity: 0 }).promise;
console.log(`${doc.numPages} pages`);

function writeRaw(img, file) {
  const { width, height, data, kind } = img;
  const png = new PNG({ width, height });
  for (let i = 0, j = 0; i < width * height; i++) {
    if (kind === 3) {
      png.data[i * 4] = data[j++]; png.data[i * 4 + 1] = data[j++]; png.data[i * 4 + 2] = data[j++]; png.data[i * 4 + 3] = data[j++];
    } else if (kind === 2) {
      png.data[i * 4] = data[j++]; png.data[i * 4 + 1] = data[j++]; png.data[i * 4 + 2] = data[j++]; png.data[i * 4 + 3] = 255;
    } else return false;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
  return true;
}

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  // Rendu de la page à 1600 px de large
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1600 / base.width });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const name = `page-${String(p).padStart(2, '0')}.png`;
  fs.writeFileSync(path.join(out, name), canvas.toBuffer('image/png'));

  // Images intégrées (photos) : on garde celles de plus de 300 px
  const ops = await page.getOperatorList();
  let n = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
    const id = ops.argsArray[i][0];
    const img = await new Promise((resolve) => {
      const get = (store) => {
        try { return store.get(id, resolve); } catch { return undefined; }
      };
      const r = id.startsWith('g_') ? get(page.commonObjs) : get(page.objs);
      if (r) resolve(r);
    });
    if (!img || img.width < 300 || img.height < 300) continue;
    let ok = false;
    if (img.data) ok = writeRaw(img, path.join(out, `img-p${p}-${++n}.png`));
    else if (img.bitmap) {
      const c = createCanvas(img.width, img.height);
      c.getContext('2d').drawImage(img.bitmap, 0, 0);
      fs.writeFileSync(path.join(out, `img-p${p}-${++n}.png`), c.toBuffer('image/png'));
      ok = true;
    }
    if (ok) console.log(`  p${p} image ${n} : ${img.width}×${img.height}`);
  }
  console.log(`page ${p} → ${name}`);
}
