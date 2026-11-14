/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { brand } from './src/app/brand';

export default defineConfig({
  plugins: [
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
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
