import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Come apps/web: file statici con percorsi relativi, quindi la demo funziona anche in una sottocartella
// (su GitHub Pages è servita da /ExpenseCalcolator/). Porte diverse da quelle della web app, perché si
// possano avviare insieme e ognuna abbia il proprio archivio nel browser.
export default defineConfig({
  base: './',
  // L'icona è quella della web app: non serve copiarla.
  publicDir: '../web/public',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1000 },
  server: { host: 'localhost', port: 5174 },
  preview: { host: 'localhost', port: 4175 },
});
