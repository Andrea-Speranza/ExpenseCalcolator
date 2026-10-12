# packages/engine — API pubblica

È l'unico punto d'ingresso per la UI e per qualsiasi altro consumatore (test, CLI, worker).

- **Comandi e query** come messaggi JSON serializzabili; le risposte sono di tipo `Result`.
- **`subscribe`** per ricevere le notifiche quando lo stato cambia.
- **Porte** che la piattaforma deve fornire: `LocalStore`, `RemoteStore`, `Clock`, `IdGenerator`.
- **Implementazioni in memoria** delle porte, da usare nei test.

- **Dipende da:** `schema`, `core`, `sync`.
- **Stato:** da implementare, Fase 2.

Dettagli: [PLANNING §5](../../docs/PLANNING.md#5-esposizione-delle-funzionalità-api).
