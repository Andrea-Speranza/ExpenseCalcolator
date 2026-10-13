# packages/ui — Interfaccia

L'app completa in React, uguale in tutte le shell: web, Windows e Android. La shell apre l'engine con gli
adapter della propria piattaforma e lo passa alla UI:

```tsx
import '@expense/ui/styles.css';
import { App } from '@expense/ui';

root.render(<App engine={engine} />);
```

- Importa solo `engine` (e i tipi da `schema`): non sa su quale piattaforma gira.
- React + Vite ([ADR 0002](../../docs/adr/0002-framework-ui-react.md)), componenti shadcn/ui con Tailwind CSS 4
  ([ADR 0008](../../docs/adr/0008-componenti-ui-shadcn.md)).
- Testi in italiano, importi e date formattati con `Intl`. Tema chiaro o scuro come il sistema operativo.
- Navigazione con l'hash dell'indirizzo (`#/gruppi/…`): funziona da file locali e nelle WebView, senza
  configurare un server.

## Struttura

| Percorso                          | Contenuto                                                                                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.tsx`                     | Radice: collega l'engine e sceglie la pagina                                                                                                                   |
| `src/screens/`                    | Schermate: gruppi (con importazione), gruppo (spese, saldi, membri) e sue impostazioni (nome, esportazione, archivio), spesa, rimborso, impostazioni personali |
| `src/engine/`                     | Collegamento tra engine e React: `useQuery` (con `useSyncExternalStore`), `useCommand`                                                                         |
| `src/expense-draft.ts`            | Form della spesa: dai testi scritti ai dati del comando, con gli errori per campo                                                                              |
| `src/amounts.ts`, `src/format.ts` | Lettura e formattazione di importi, percentuali e date                                                                                                         |
| `src/messages.ts`                 | Errori dell'engine spiegati in italiano                                                                                                                        |
| `src/router.ts`                   | Pagine e indirizzi                                                                                                                                             |
| `src/download.ts`                 | Salvataggio dei file esportati (da verificare nelle WebView delle app native, Fase 4)                                                                          |
| `src/components/`                 | Componenti dell'app (struttura della pagina, scelta della valuta, errori)                                                                                      |
| `src/components/ui/`              | Componenti di shadcn/ui, generati dalla sua CLI                                                                                                                |

## Componenti di shadcn/ui

Si aggiungono con la CLI di shadcn, dalla radice del repository:

```sh
pnpm dlx shadcn@4.21.4 add <componente> -c packages/ui
```

La configurazione è in `components.json`. I file generati non si correggono a mano: per aggiornarli si
rigenerano (`--overwrite`).

## Test

In `test/`: la logica senza grafica (importi, form della spesa, indirizzi, file esportati) e test d'integrazione con jsdom e
Testing Library, che usano l'app intera con un engine in memoria come farebbe una persona.

Dettagli: [PLANNING §7](../../docs/PLANNING.md#7-ui-pagine-web-locali-dentro-app-native).
