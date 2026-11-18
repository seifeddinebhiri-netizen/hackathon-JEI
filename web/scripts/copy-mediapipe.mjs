// Copie les fichiers WASM de MediaPipe (≈ 15 Mo chacun) depuis node_modules vers public/mediapipe/,
// pour que le site les serve lui-même : le Coach détecte les visages sans réseau et sans CDN.
// Lancé automatiquement après `npm install` et avant `npm run dev` / `npm run build`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe', 'wasm');

if (!existsSync(from)) {
  console.warn('[copy-mediapipe] @mediapipe/tasks-vision absent : lance `npm install`.');
} else {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log('[copy-mediapipe] WASM copiés dans public/mediapipe/wasm');
}
