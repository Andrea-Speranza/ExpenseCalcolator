# packages/adapters — Implementazioni delle porte

| Adapter                             | Porta         | Piattaforme                                                   | Fase |
| ----------------------------------- | ------------- | ------------------------------------------------------------- | ---- |
| [local-indexeddb](local-indexeddb/) | `LocalStore`  | Tutte (browser e WebView)                                     | 2    |
| [remote-folder](remote-folder/)     | `RemoteStore` | Desktop (Tauri fs); web con Chromium (File System Access API) | 5    |
| [remote-gdrive](remote-gdrive/)     | `RemoteStore` | Web, Android, desktop                                         | 6    |

Ogni adapter dipende solo dalle interfacce delle porte (`engine`) e dai tipi (`schema`).
Ogni adapter deve passare la suite di test di contratto della sua porta.
