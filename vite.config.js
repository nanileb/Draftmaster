import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// Publié sur GitHub Pages sous https://nanileb.github.io/draftmaster/
export default defineConfig({
  base: '/draftmaster/',
  logLevel: 'warn',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
