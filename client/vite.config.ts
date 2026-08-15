import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Fondation posee par le Maitre (C01), etendue par Worker C : alias @, proxy /api vers le BFF,
// PWA-ready, decoupage par vendor, cache-buster des donnees statiques.
//
// __DATA_V__ : jeton de cache des donnees non hashees (GeoJSON/JSON de public/data), repris de la v2.
// Fige au build via la variable d'environnement DATA_V ; en dev il vaut 'dev'.
const DATA_V = process.env.DATA_V ?? 'dev';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // PWA-ready ET offline (C11) : le shell est precache (Workbox), les tuiles carto et l'API sont
      // cachees au runtime. Installable (icone SVG). autoUpdate = le SW se met a jour tout seul.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Barjøtur',
        short_name: 'Barjøtur',
        description: 'Le voyage qui vous ressemble.',
        lang: 'fr',
        theme_color: '#2B2724',
        background_color: '#F5F0E7',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // Repli de navigation offline sur l'app shell (SPA).
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Fonds de carte OpenFreeMap : cache-first (les tuiles bougent peu), pour une carte offline.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tuiles-openfreemap',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API du BFF : network-first (fraicheur), repli sur le dernier cache si hors ligne.
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-barjotur',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __DATA_V__: JSON.stringify(DATA_V),
  },
  server: {
    port: 5180,
    // Le lecteur Conseils (T056) bundle le markdown de `documentation/conseils/` (racine du repo, hors client/)
    // via import.meta.glob ?raw : on autorise Vite a lire un cran au-dessus de la racine du front (M198 opt.A,
    // source de verite dans documentation/, zero copie).
    fs: {
      allow: ['..'],
    },
    proxy: {
      // Le front ne parle qu'au BFF (B) : tout /api est proxifie en dev vers le serveur Node. Cible réglable
      // par `BFF_TARGET` (vérif C-10 contre le BFF booté de B sur :8080, M133/B060) ; défaut :3000.
      '/api': {
        target: process.env.BFF_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Isole les gros vendors pour un chargement fin (la carto reste hors du chemin critique).
        manualChunks: {
          maplibre: ['maplibre-gl', '@vis.gl/react-maplibre'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  // Tests scopes a src/ : on n'execute jamais un test egare dans .trash/ ou dist/.
  test: {
    include: ['src/**/*.test.ts'],
  },
});
