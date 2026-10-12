# packages/core — Logica di calcolo

Contiene la logica di calcolo, in forma pura e deterministica.

| Funzione                                            | Cosa fa                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `money`, `add`, `subtract`, `sum`, `negate`, `zero` | Operazioni su importi (`Money`: unità minori intere più valuta), senza mai mescolare valute              |
| `fromDecimalString`, `toDecimalString`              | Conversione da e verso testo decimale ("12.34"), senza arrotondamenti                                    |
| `decimalsOf`, `isKnownCurrency`, `knownCurrencies`  | Tabella delle valute ISO 4217 ([ADR 0004](../../docs/adr/0004-valute.md))                                |
| `allocate`                                          | Ripartizione proporzionale con il metodo del resto maggiore                                              |
| `splitExpense`                                      | Verifica una spesa e calcola quanto spetta a ciascuno (parti uguali, importi esatti, percentuali, quote) |
| `computeBalances`, `validateSettlement`             | Saldi per membro e per valuta, da spese e rimborsi                                                       |
| `simplifiedTransfers`, `pairwiseTransfers`          | Trasferimenti suggeriti, semplificati o per coppia                                                       |

Ogni funzione che può fallire restituisce un `Result` con un errore tipizzato (`code`), mai un'eccezione.

**Vincoli:**

- niente I/O, DOM, API di Node, `Date.now()`, `Math.random()`;
- nessuna dipendenza a runtime: da `schema` importa solo tipi;
- risultati identici su ogni dispositivo: ordinamenti per codice dei caratteri, mai secondo la lingua.

**Test:** unitari, property-based (fast-check) e i test vector di [`spec/test-vectors`](../../spec/test-vectors/).
La copertura minima richiesta è il 95%.

- **Dipende da:** `schema` (solo tipi).
- **Stato:** Fase 1 completata.

Dettagli: [PLANNING §4](../../docs/PLANNING.md#4-core-di-calcolo-cross-platform) e
[§9](../../docs/PLANNING.md#9-specifica-della-logica-di-calcolo).
