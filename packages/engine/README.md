# packages/engine — API pubblica

È l'unico punto d'ingresso per la UI e per qualsiasi altro consumatore (test, CLI, worker).

- **Comandi e query** come messaggi JSON serializzabili; le risposte sono di tipo `Result`.
- **`subscribe`** per ricevere le notifiche quando lo stato cambia.
- **Porte** che la piattaforma deve fornire: `LocalStore`, `Clock`, `IdGenerator`.
- **Porta `SyncChannel`** per i canali di condivisione, che sono plugin separati in
  [packages/channels](../channels/) ([ADR 0006](../../docs/adr/0006-canali-plugin.md)).
- **Implementazioni in memoria** delle porte, da usare nei test.

Già disponibile: `calculateLedger`, una query senza stato che valida un registro esterno e ne calcola saldi e
trasferimenti. La usa la CLI.

- **Dipende da:** `schema`, `core`, `sync`.
- **Stato:** Fase 2 in preparazione; il salvataggio con gestione delle modifiche contemporanee è proposto
  in [ADR 0007](../../docs/adr/0007-salvataggio-e-concorrenza.md).

Dettagli: [PLANNING §5](../../docs/PLANNING.md#5-esposizione-delle-funzionalità-api).
