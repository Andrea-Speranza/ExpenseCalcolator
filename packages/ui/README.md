# packages/ui — Interfaccia (SPA)

Single page application compilata in file statici (HTML/CSS/JS). Tutte le shell usano gli stessi file:
la PWA, Tauri su Windows e Tauri (o Capacitor) su Android.

- Importa solo `engine` (e i tipi da `schema`).
- Non sa su quale piattaforma gira: è la shell a collegare gli adapter all'engine.
- Framework: React + Vite ([ADR 0002](../../docs/adr/0002-framework-ui-react.md)). Libreria di componenti da decidere (D8).

- **Stato:** da implementare, Fase 3.

Dettagli: [PLANNING §7](../../docs/PLANNING.md#7-ui-pagine-web-locali-dentro-app-native).
