# channels/folder — Cartella sincronizzata

Canale "a deposito" ([ADR 0006](../../../docs/adr/0006-canali-plugin.md)). Legge e scrive i segmenti in una
cartella del disco già sincronizzata da Google Drive per desktop, OneDrive, Dropbox o Syncthing. Non servono
API né login.

- **Desktop:** plugin fs di Tauri.
- **Web (solo Chromium):** File System Access API.

È anche il canale di riferimento per sviluppare e testare la sincronizzazione.

- **Stato:** da implementare, Fase 5.

Dettagli: [PLANNING §8.6](../../../docs/PLANNING.md#86-canali-di-condivisione-plugin).
