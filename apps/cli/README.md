# apps/cli — Riga di comando

Gestisce gruppi e spese da terminale, con i dati salvati sul computer: è l'app in **modalità locale**
([ADR 0005](../../docs/adr/0005-modalita-uso.md)), senza grafica. Usa solo `@expense/engine`, come faranno la
UI web e le app native.

## Avvio

Dalla radice del repository (oppure da qualsiasi cartella con `pnpm -w cli`):

```sh
pnpm cli --help
pnpm cli gruppo crea "Weekend in montagna" --io Anna
```

`pnpm cli` compila la CLI in un unico file, `apps/cli/dist/spese.mjs`, che si può anche eseguire
direttamente con Node 22: `node spese.mjs <comando>`.

I dati si salvano nella cartella dell'utente (su Windows `%APPDATA%\ExpenseCalcolator`, su macOS
`~/Library/Application Support/ExpenseCalcolator`, su Linux `~/.local/share/expense-calcolator`). Per usarne
un'altra: `--dati <cartella>` oppure la variabile `SPESE_DATI`.

## Un esempio completo

```sh
spese gruppo crea "Weekend in montagna" --io Anna
spese membro aggiungi montagna Luca
spese membro aggiungi montagna Sara
spese spesa aggiungi montagna "Cena al rifugio" 120,50 --ora 20:30
spese spesa aggiungi montagna Benzina 60 --pagato Luca --tra Anna,Luca
spese spesa aggiungi montagna Funivia 90 --valuta CHF --pagato Sara --quote Anna=1,Luca=1,Sara=1
spese rimborso aggiungi montagna Sara Anna 20
spese saldi montagna
spese trasferimenti montagna
```

## Comandi

| Comando                                                         | Cosa fa                                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `gruppi`                                                        | Elenca i gruppi                                                                              |
| `gruppo crea <nome> [--io <nome>] [--valuta <codice>]`          | Crea un gruppo; con `--io` ne fai parte anche tu                                             |
| `gruppo mostra <gruppo>`                                        | Membri, spese, rimborsi ed eventuali modifiche contemporanee                                 |
| `gruppo rinomina` · `archivia` · `riattiva`                     | Cambia nome o archivia il gruppo                                                             |
| `gruppo io <gruppo> <membro>`                                   | Indica quale membro sei tu ("nessuno" se non ne fai parte)                                   |
| `membro aggiungi` · `rinomina` · `archivia` · `riattiva`        | Gestione dei membri                                                                          |
| `spesa aggiungi <gruppo> <descrizione> <importo>`               | Registra una spesa                                                                           |
| `spesa modifica <gruppo> <spesa>`                               | Modifica solo ciò che indichi                                                                |
| `spesa elimina` · `ripristina`                                  | Elimina (resta nello storico) o ripristina                                                   |
| `rimborso aggiungi <gruppo> <da> <a> <importo>`                 | Registra un rimborso                                                                         |
| `rimborso elimina` · `ripristina`                               | Elimina o ripristina un rimborso                                                             |
| `saldi <gruppo>`                                                | Saldo di ogni membro, per valuta                                                             |
| `trasferimenti <gruppo> [--per-coppia]`                         | Pagamenti suggeriti per pareggiare i conti                                                   |
| `impostazioni [--valuta] [--lingua] [--nome]`                   | Mostra o cambia le impostazioni personali                                                    |
| `esporta <gruppo> <file>` · `importa <file>`                    | Passa un gruppo a un altro dispositivo o persona tramite file (stesso formato della web app) |
| `registro verifica` · `saldi` · `trasferimenti <registro.json>` | Calcoli su un registro letto da file, senza salvare nulla                                    |

Ogni comando ha il suo aiuto: `spese spesa aggiungi --help`. Con `--json` il risultato esce in JSON, per altri
programmi. Exit code: `0` tutto bene, `1` errore nei dati, `2` comando usato in modo sbagliato.

## Come si scrive

- **Gruppi e membri:** per nome, senza badare a maiuscole e minuscole. Basta anche una parte del nome, se
  corrisponde a un solo gruppo o membro (`montagna`). "io" indica il membro che sei tu. Nella stessa CLI non si
  possono creare due gruppi, o due membri dello stesso gruppo, con lo stesso nome.
- **Spese e rimborsi:** con la descrizione oppure con il codice breve mostrato da `gruppo mostra` (es.
  `#3k9f2a`).
- **Importi:** `12`, `12,50` o `12.50`. Mai arrotondati: più decimali di quelli della valuta sono un errore.
- **Chi ha pagato:** `--pagato Anna` (tutto), oppure `--pagato Anna=60 --pagato Luca=30`. Senza `--pagato` hai
  pagato tu.
- **Divisione** (una sola opzione; senza opzioni, parti uguali tra tutti i membri attivi):
  - `--tra Anna,Luca`: parti uguali;
  - `--importi Anna=50,Luca=40,50`: importi esatti;
  - `--percentuali Anna=33,33,Luca=66,67`: percentuali;
  - `--quote Anna=2,Luca=1`: quote intere.

  Negli elenchi la virgola decimale si riconosce da sola; si può separare anche con `;`.

- **Date:** `2026-10-12` o `12/10/2026`; senza `--data` vale oggi.
- **Ora della spesa (facoltativa):** `--ora 20:30` (anche `20.30` o `9:05`); in `spesa modifica`, `--ora ""` la toglie.

## Registro su file

`spese registro …` calcola saldi e trasferimenti da un file JSON, nello stesso formato dei test vector
([spec/README.md](../../spec/README.md)), senza toccare i dati salvati. Si possono aggiungere i nomi dei
membri (`members: [{ "id": "m_anna", "name": "Anna" }]`) e le descrizioni delle spese. Un esempio è
[examples/weekend.json](examples/weekend.json). I file salvati in UTF-8 con BOM (es. da PowerShell 5.1) vengono
letti correttamente.
