import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const port = Number(process.env.PORT) || 22681;
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,

  plugins: [
    react(),

    tailwindcss({ optimize: false }),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: ['favicon.svg', 'logo.svg', 'pwa-192x192.png', 'pwa-512x512.png'],

      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/functions\//],
      },

      manifest: {
        name: 'VetDesk',
        short_name: 'VetDesk',
        id: '/',

        description:
          'Veterinary clinic management application for pets, owners, appointments and recalls.',

        theme_color: '#0d4f6c',
        background_color: '#faf9f6',

        display: 'standalone',

        start_url: '/',
        scope: '/',

        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),

  ],

  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },

    dedupe: ['react', 'react-dom'],
  },

  root: path.resolve(import.meta.dirname),

  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'wouter'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },

  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,

    fs: {
      strict: true,
    },
  },

  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
