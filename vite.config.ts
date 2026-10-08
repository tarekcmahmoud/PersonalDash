/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The main chunk is mostly Primer React (~130 kB gzipped); secondary routes and the backend load on demand.
  build: { chunkSizeWarningLimit: 700 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Primer React ships .css imports from node_modules; let Vite transform them instead of Node.
    server: { deps: { inline: [/@primer\/react/] } },
  },
})
