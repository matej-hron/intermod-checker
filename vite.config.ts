/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/, so assets must be
  // requested from that subpath. Local dev and preview stay at the root.
  base: process.env.GITHUB_PAGES === 'true' ? '/intermod-checker/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
