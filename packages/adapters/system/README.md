# adapters/system — Orologio e id della piattaforma

Implementa le porte `Clock` e `IdGenerator` dell'engine con le API disponibili ovunque l'app gira (browser,
WebView di Windows e Android, Node):

- `createSystemClock()`: l'ora di sistema;
- `createUlidGenerator()`: id ULID, ordinati per tempo di creazione, con 80 bit casuali presi da Web Crypto.

Nei test si usano invece l'orologio manuale e gli id sequenziali dell'engine (`createManualClock`,
`createSequentialIds`).

- **Dipende da:** `engine` (solo le interfacce delle porte).
