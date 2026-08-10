/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project site from /<repo>/, so assets must be
// requested from that subpath. Local dev and preview stay at the root.
const base = process.env.GITHUB_PAGES === 'true' ? '/intermod-checker/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // 'prompt', never 'autoUpdate': a new worker taking control reloads the
      // page, and this app can be open on a phone mid-show. The user decides.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Intermodulation Checker',
        short_name: 'Intermod',
        description:
          'Check wireless microphone frequencies for intermodulation interference. Works offline.',
        // These must carry the deployment base or the manifest is rejected.
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#15161a',
        theme_color: '#15161a',
        icons: [
          { src: `${base}pwa-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}pwa-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}pwa-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The analysis Web Worker is emitted as its own chunk. If it is not
        // precached the installed app opens and then cannot compute anything,
        // which is the worst possible offline failure.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
