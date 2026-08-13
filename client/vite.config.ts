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
      // On ne construit pas l'offline maintenant : on structure pour que PWA puis Capacitor
      // ne soient qu'un branchement (A06). registerType 'prompt' = pas de mise a jour silencieuse.
      registerType: 'prompt',
      manifest: {
        name: 'Barjøtur',
        short_name: 'Barjøtur',
        description: 'Le voyage qui vous ressemble.',
        lang: 'fr',
        theme_color: '#2B2724',
        background_color: '#F5F0E7',
        display: 'standalone',
        icons: [],
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
    proxy: {
      // Le front ne parle qu'au BFF (B) : tout /api est proxifie en dev vers le serveur Node.
      '/api': {
        target: 'http://localhost:3000',
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
