import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// La build produce file statici con percorsi relativi: funzionano da qualsiasi cartella, dentro le app
// native (Fase 4) o su un futuro hosting, senza cambiare configurazione (ADR 0009).
// Il server di sviluppo e l'anteprima ascoltano solo su localhost: la web app non è raggiungibile dalla rete.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // L'app si carica dal disco (app native) o da localhost: dividerla in più file non la renderebbe più veloce.
  // L'avviso resta per accorgersi se le dipendenze crescono troppo.
  build: { chunkSizeWarningLimit: 1000 },
  server: { host: 'localhost' },
  preview: { host: 'localhost' },
});
