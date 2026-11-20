import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base relative : le dossier dist/ s'ouvre depuis n'importe quel serveur statique (ou une clé USB).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 4173 },
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
