# apps/cli — Riga di comando

Calcola saldi e trasferimenti da un registro di spese salvato in un file JSON. È la prima "shell" del
progetto: usa solo `@expense/engine`, come faranno la UI web e le app native, e dimostra che la logica
funziona senza nessuna interfaccia grafica.

## Uso

Dalla radice del repository (oppure da qualsiasi cartella con `pnpm -w cli`):

```sh
pnpm cli verifica apps/cli/examples/weekend.json
pnpm cli saldi apps/cli/examples/weekend.json
pnpm cli trasferimenti apps/cli/examples/weekend.json
pnpm cli trasferimenti apps/cli/examples/weekend.json --per-coppia
pnpm cli saldi apps/cli/examples/weekend.json --json
```

`pnpm cli` compila la CLI in un unico file, `apps/cli/dist/spese.mjs`, che si può anche eseguire
direttamente con Node 22 su qualsiasi computer: `node spese.mjs saldi registro.json`.

| Comando         | Risultato                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `verifica`      | Controlla il registro: numero di spese e rimborsi, valute usate                                                      |
| `saldi`         | Saldo di ogni membro, per valuta                                                                                     |
| `trasferimenti` | Pagamenti suggeriti per pareggiare i conti (semplificati; con `--per-coppia` ognuno paga solo chi ha pagato per lui) |

Opzioni: `--json` per un risultato da usare in altri programmi, `-h` / `--help` per l'aiuto.
Exit code: `0` tutto bene, `1` registro non leggibile o non valido, `2` comando usato in modo sbagliato.

## Formato del registro

È lo stesso formato dei test vector ([spec/README.md](../../spec/README.md)): `expenses` e `settlements`, con
importi interi in unità minori e la loro valuta. In più si possono aggiungere:

- `members`: `[{ "id": "m_anna", "name": "Anna" }]`, per mostrare i nomi al posto degli id;
- `description` nelle spese, ignorata dal calcolo ma utile a chi legge il file.

Un esempio completo è [examples/weekend.json](examples/weekend.json): quattro amici, più pagatori, tutte le
modalità di divisione, una spesa in franchi svizzeri e un rimborso.

Gli errori indicano il campo da correggere (es. `expenses.0.total.minor`) e sono in italiano. I file salvati
in UTF-8 con BOM (es. da PowerShell 5.1) vengono letti correttamente.
