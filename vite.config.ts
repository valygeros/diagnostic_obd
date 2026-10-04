/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Relative base: the site works whatever the hosting sub-path (GitHub Pages, Netlify…).
  base: './',
  // `npm run dev:https` serves over HTTPS on the LAN so a phone can open the dev site
  // (Web Bluetooth requires a secure context outside localhost).
  plugins: [svelte(), ...(mode === 'https' ? [basicSsl()] : [])],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/ui/**'],
    },
  },
}))
