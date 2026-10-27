import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dojo from './tools/vite-plugin-dojo';

// Хэш-роутинг + относительный base: сайт работает из любой подпапки (GitHub Pages /<repo>/).
const base = './';

export default defineConfig({
  base,
  plugins: [react(), dojo()],
  define: { global: 'globalThis' },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
