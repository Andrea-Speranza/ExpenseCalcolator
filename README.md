# ExpenseCalcolator

Gestione delle spese di gruppo, stile Splitwise. L'app è:

- **local-first:** i dati vivono sul dispositivo e l'app funziona offline;
- **multipiattaforma:** web, Windows, Android;
- **senza backend:** la condivisione passa dallo storage cloud degli utenti (es. Google Drive).

> **Stato:** Fasi 1 (logica di calcolo), 2 (eventi, salvataggio, engine) e 3 (UI) completate: la web app
> funziona in locale nel browser (`pnpm web`). Fase 4 in corso: l'app per Windows (Tauri) funziona
> (`pnpm native`); Android verrà dopo, in un ambiente di sviluppo dedicato.
> Tutto parte da [docs/PLANNING.md](docs/PLANNING.md); com'è costruito il sistema oggi è in
> [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).

## Cosa si può fare oggi

Su un solo dispositivo, senza account né rete, dalla web app (`pnpm web`) o dalla riga di comando
(`pnpm cli`):

- usare l'app in italiano o in inglese (all'inizio nella lingua del dispositivo);
- creare gruppi, aggiungere le persone e indicare chi sei;
- registrare spese con uno o più pagatori, divise in parti uguali, per importi, percentuali o quote, con data e
  ora facoltativa;
- vedere saldi e trasferimenti suggeriti, registrare i rimborsi;
- ritrovare tutto nello storico, filtrare le spese pagate da te o per te, eliminare e ripristinare;
- vedere nell'elenco dei gruppi quali hanno conti aperti e quali sono in pari, e archiviare quelli conclusi;
- esportare un gruppo su file e importarlo su un altro dispositivo o nella CLI (copia di sicurezza o passaggio
  ad altri).

La sincronizzazione automatica tra dispositivi e la condivisione arrivano con le Fasi 5 e 6.

## Sviluppo

Prerequisiti: Node.js ≥ 22.13 e pnpm 10. La versione di pnpm è fissata nel campo `packageManager`.

```sh
pnpm install          # installa le dipendenze di tutto il workspace
pnpm check            # formattazione, lint, tipi, confini tra pacchetti, test e build (lo stesso comando della CI)
pnpm e2e              # test E2E della web app in un browser vero (Playwright; in locale usa Edge)
pnpm test:watch       # test in modalità watch
pnpm coverage         # test con copertura
pnpm format           # formatta tutti i file
pnpm web              # la web app su http://localhost:5173, con i dati nel browser (vedi apps/web/README.md)
pnpm web:preview      # build e anteprima della versione finale
pnpm native           # l'app per Windows (Tauri) in sviluppo; native:build crea l'installer (vedi apps/native/README.md)
pnpm cli --help       # la riga di comando: gruppi e spese salvati in locale (vedi apps/cli/README.md)
pnpm schemas          # rigenera i JSON Schema in spec/schemas dopo aver cambiato packages/schema
pnpm deps:graph       # rigenera il grafico delle dipendenze in docs/ARCHITETTURA.md
```

I singoli controlli si possono lanciare anche separatamente: `pnpm lint`, `pnpm typecheck`, `pnpm deps`, `pnpm test`.

## Struttura

| Cartella                                | Contenuto                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [docs/](docs/)                          | Pianificazione, [architettura](docs/ARCHITETTURA.md), decisioni (ADR), [alternative per la condivisione](docs/CONDIVISIONE.md) |
| [spec/](spec/)                          | Contratti indipendenti dal linguaggio: JSON Schema e test vector                                                               |
| [packages/schema](packages/schema/)     | Modelli dati ed eventi condivisi                                                                                               |
| [packages/core](packages/core/)         | Logica di calcolo pura                                                                                                         |
| [packages/sync](packages/sync/)         | Log di eventi, orologio logico, merge                                                                                          |
| [packages/engine](packages/engine/)     | API pubblica usata dalla UI                                                                                                    |
| [packages/i18n](packages/i18n/)         | Lingue, testi condivisi e formati di importi e date (italiano e inglese)                                                       |
| [packages/adapters](packages/adapters/) | Porte di piattaforma: salvataggio locale (IndexedDB, file JSON), orologio e id                                                 |
| [packages/channels](packages/channels/) | Canali di condivisione, ognuno un plugin separato: file, cartella, peer-to-peer, cloud                                         |
| [packages/ui](packages/ui/)             | Interfaccia (SPA in React con shadcn/ui), uguale in tutte le shell                                                             |
| [apps/cli](apps/cli/)                   | Riga di comando: l'app in modalità locale, senza grafica                                                                       |
| [apps/web](apps/web/)                   | Shell web: la UI con i dati nel browser (per ora solo in locale)                                                               |
| [apps/native](apps/native/)             | Shell nativa (Tauri 2: Windows, Android)                                                                                       |

Regola d'oro: le dipendenze vanno solo verso il basso, `ui → engine → core/sync → schema`.
