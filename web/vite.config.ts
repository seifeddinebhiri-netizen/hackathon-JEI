/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { brand } from './src/app/brand';

// `npm run dev:phone` : serveur accessible sur le réseau en HTTPS (la caméra du téléphone l'exige).
export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'phone' ? [basicSsl()] : []),
    // %BRAND_*% dans index.html (nom, description, icônes) viennent de src/app/brand.ts
    {
      name: 'brand-html',
      transformIndexHtml: (html) =>
        html
          .replaceAll('%BRAND_NAME%', brand.name)
          .replaceAll('%BRAND_FAVICON%', brand.logos.favicon)
          .replaceAll('%BRAND_FAVICON_PNG%', brand.logos.faviconPng)
          .replaceAll('%BRAND_APPLE_ICON%', brand.logos.appleTouch)
          .replaceAll(
            '%BRAND_DESCRIPTION%',
            `${brand.name} ${brand.description.charAt(0).toLowerCase()}${brand.description.slice(1)}`,
          ),
    },
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'brand/svg/encadre-favicon.svg',
        'brand/svg/encadre-logo-transparent-*.svg',
        'icons/*.png',
        'coach/*.svg', // maquettes des consignes du Coach : mises en cache pour le hors ligne
      ],
      manifest: {
        name: brand.name,
        short_name: brand.shortName,
        description: brand.tagline,
        lang: 'fr',
        theme_color: brand.colors.background,
        background_color: brand.colors.background,
        display: 'standalone',
        start_url: '/projet',
        icons: [
          { src: brand.logos.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: brand.logos.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: brand.logos.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: brand.logos.icon, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Le détecteur de visages (≈ 15 Mo de WASM + un modèle) ne doit PAS être téléchargé à
        // l'installation : il est mis en cache la première fois que le Coach l'utilise, puis
        // servi hors ligne.
        globIgnores: ['mediapipe/**', 'models/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/mediapipe/') || url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'coach-models', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    // Le téléphone ouvre le site en HTTPS : il ne peut pas appeler un backend en http (contenu mixte).
    // Avec VITE_API_URL=/api, le serveur de dev relaie vers le backend de cet ordinateur.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
