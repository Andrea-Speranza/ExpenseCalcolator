# adapters/remote-folder — RemoteStore su cartella sincronizzata

Legge e scrive i segmenti in una cartella del disco già sincronizzata da Google Drive per desktop, OneDrive,
Dropbox o Syncthing. Non servono API né login.

- **Desktop:** plugin fs di Tauri.
- **Web (solo Chromium):** File System Access API.

È anche l'adapter di riferimento per sviluppare e testare la sync.

- **Stato:** da implementare, Fase 5.

Dettagli: [PLANNING §8.6](../../../docs/PLANNING.md#86-provider-adapter-remotestore).
