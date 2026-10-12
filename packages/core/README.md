# packages/core — Logica di calcolo

Contiene la logica di calcolo, in forma pura e deterministica:

- importi (`Money`: unità minori intere più valuta) e tabella delle valute ISO 4217 ([ADR 0004](../../docs/adr/0004-valute.md));
- ripartizione con il metodo del resto maggiore;
- modalità di divisione: parti uguali, importi esatti, percentuali, quote;
- saldi per membro e per valuta;
- trasferimenti suggeriti, semplificati e per coppia.

**Vincoli:**

- niente I/O, DOM, API di Node, `Date.now()`, `Math.random()`;
- nessuna dipendenza a runtime;
- errori restituiti come `Result`, non come eccezioni.

- **Dipende da:** `schema` (solo tipi).
- **Stato:** da implementare, Fase 1.

Dettagli: [PLANNING §4](../../docs/PLANNING.md#4-core-di-calcolo-cross-platform) e
[§9](../../docs/PLANNING.md#9-specifica-della-logica-di-calcolo).
