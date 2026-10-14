# packages/ui — Interfaccia

L'app completa in React, uguale in tutte le shell: web, Windows e Android. La shell apre l'engine con gli
adapter della propria piattaforma e lo passa alla UI:

```tsx
import '@expense/ui/styles.css';
import { detectLanguage } from '@expense/i18n';
import { App } from '@expense/ui';

root.render(<App engine={engine} defaultLanguage={detectLanguage(navigator.languages)} />);
```

- Importa solo `engine` (e i tipi da `schema`): non sa su quale piattaforma gira.
- React + Vite ([ADR 0002](../../docs/adr/0002-framework-ui-react.md)), componenti shadcn/ui con Tailwind CSS 4
  ([ADR 0008](../../docs/adr/0008-componenti-ui-shadcn.md)).
- Testi in italiano e inglese ([ADR 0010](../../docs/adr/0010-localizzazione.md)), importi e date formattati
  con `Intl` nella lingua scelta. Tema chiaro o scuro come il sistema operativo.
- Navigazione con l'hash dell'indirizzo (`#/gruppi/…`): funziona da file locali e nelle WebView, senza
  configurare un server.

## Schermate

- **Gruppi** (`#/`, `#/archiviati`): attivi e archiviati in due schede. Per ogni gruppo: data di creazione,
  valuta e stato dei conti («Nessuna spesa», «Conti aperti» con quanto devi o ti devono, «In pari»). Da qui si
  crea un gruppo o se ne importa uno da file.
- **Gruppo** (`#/gruppi/<id>`), in quattro schede:
  - **Spese:** totale, filtri «Pagate da me» e «Pagate per me», righe con data (e ora), chi ha pagato in
    evidenza, le persone tra cui è divisa e l'ultima modifica; eliminazione con conferma e ripristino;
  - **Saldi:** saldo di ciascuno, trasferimenti suggeriti (meno passaggi o per coppia) da segnare come pagati,
    rimborsi registrati;
  - **Storico:** spese e rimborsi insieme, per giorno e ora di inserimento;
  - **Membri:** aggiungi, rinomina, archivia, «Sono io».
- **Impostazioni del gruppo** (`#/gruppi/<id>/impostazioni`): nome, esportazione su file, archivio.
- **Spesa** (`#/gruppi/<id>/spese/nuova` o `/<id spesa>`): descrizione, importo, data e ora facoltativa, uno o
  più pagatori, divisione in parti uguali (con «Tutti»), per importi, percentuali o quote; in modifica mostra
  quando è stata inserita e modificata.
- **Impostazioni personali** (`#/impostazioni`): nome e valuta predefinita.

## Struttura

| Percorso                          | Contenuto                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `src/app.tsx`                     | Radice: collega l'engine e sceglie la pagina                                           |
| `src/screens/`                    | Le schermate elencate sopra                                                            |
| `src/engine/`                     | Collegamento tra engine e React: `useQuery` (con `useSyncExternalStore`), `useCommand` |
| `src/expense-draft.ts`            | Form della spesa: dai testi scritti ai dati del comando, con gli errori per campo      |
| `src/group-data.ts`               | Dati per le schermate: partecipanti, filtri, ordinamento, stato dei conti              |
| `src/amounts.ts`, `src/format.ts` | Lettura e formattazione di importi, percentuali, date e ore                            |
| `src/messages.ts`                 | Testi dei problemi nei form (gli errori dell'engine sono in `@expense/i18n`)           |
| `src/i18n/`                       | Dizionari della UI (`it.json`, `en.json`), chiavi `K`, `useI18n()` e provider          |
| `src/router.ts`                   | Pagine e indirizzi                                                                     |
| `src/download.ts`                 | Salvataggio dei file esportati (da verificare nelle WebView delle app native, Fase 4)  |
| `src/components/`                 | Componenti dell'app: pagina, conferma di eliminazione, etichette, valuta, errori       |
| `src/components/ui/`              | Componenti di shadcn/ui, generati dalla sua CLI                                        |

## Testi e lingue

I testi stanno in `src/i18n/it.json` ed `en.json`; nei componenti si usano solo le chiavi:

```tsx
const { t, format } = useI18n();
<h1>{t(K.groups.title)}</h1>
<p>{t(K.groups.created, { day: format.date(date) })}</p>
```

- Un testo nuovo si aggiunge in entrambi i dizionari; il test dei dizionari segnala ciò che manca in inglese.
- Il lint rifiuta testo scritto nel JSX o in `aria-label`, `placeholder`, `title` e `alt`, e `t()`
  chiamato con una stringa al posto di una chiave di `K`.
- La logica senza grafica (form, importi, partecipanti) restituisce codici: il testo si sceglie solo al momento
  di mostrarlo.
- La lingua è quella delle impostazioni; finché l'utente non la sceglie, quella indicata dalla shell
  (`defaultLanguage`, di solito la lingua del dispositivo).

## Componenti di shadcn/ui

Si aggiungono con la CLI di shadcn, dalla radice del repository:

```sh
pnpm dlx shadcn@4.21.4 add <componente> -c packages/ui
```

La configurazione è in `components.json`. I file generati non si correggono a mano: per aggiornarli si
rigenerano (`--overwrite`). Se la CLI chiede di sovrascrivere un componente già presente (es. `button`), si
risponde di no.

## Test

In `test/`: la logica senza grafica (importi, form della spesa, indirizzi, filtri, stato dei conti, file
esportati) e test d'integrazione con jsdom e Testing Library, che usano l'app intera con un engine in memoria
come farebbe una persona. I test E2E in un browser vero stanno in [apps/web](../../apps/web/).

Dettagli: [PLANNING §7](../../docs/PLANNING.md#7-ui-pagine-web-locali-dentro-app-native).
